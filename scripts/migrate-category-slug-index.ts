import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../src/models/categories.model.ts";

dotenv.config();

const run = async () => {
  const uri = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!uri) throw new Error("Set MONGODB_URL or MONGO_URI in .env before running this migration.");

  await mongoose.connect(uri);
  const collection = Category.collection;

  const duplicates = await collection
    .aggregate([
      { $match: { slug: { $type: "string" } } },
      {
        $group: {
          _id: { type: { $ifNull: ["$type", null] }, slug: "$slug" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .toArray();

  if (duplicates.length > 0) {
    throw new Error("Duplicate category slugs exist within a type. Resolve them before creating the compound unique index.");
  }

  await collection.createIndex(
    { type: 1, slug: 1 },
    { unique: true, name: "type_1_slug_1" },
  );

  const indexes = await collection.listIndexes().toArray();
  for (const index of indexes) {
    const keys = Object.entries(index.key ?? {});
    const isLegacyGlobalSlugIndex =
      index.unique === true &&
      keys.length === 1 &&
      keys[0]?.[0] === "slug";

    if (isLegacyGlobalSlugIndex && index.name) {
      await collection.dropIndex(index.name);
      console.log(`Dropped legacy global category slug index: ${index.name}`);
    }
  }

  console.log("Category slug uniqueness is now scoped to category type.");
};

run()
  .catch((error) => {
    console.error("Category slug index migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
