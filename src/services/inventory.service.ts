import Product from "../models/product.model.ts";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const MAX_LOW_STOCK_THRESHOLD = 1_000;

export const listLowStockVariants = async (rawThreshold: unknown) => {
  const threshold = rawThreshold === undefined ? DEFAULT_LOW_STOCK_THRESHOLD : Number(rawThreshold);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > MAX_LOW_STOCK_THRESHOLD) {
    return {
      success: false,
      status: 400,
      code: "INVENTORY_THRESHOLD_INVALID",
      message: `threshold must be a whole number from 0 to ${MAX_LOW_STOCK_THRESHOLD}`,
    };
  }

  try {
    const variants = await Product.aggregate([
      { $match: { status: "active", isDeleted: false } },
      { $unwind: "$variants" },
      { $match: { "variants.isActive": true, "variants.stock": { $lte: threshold } } },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          productTitle: "$title",
          productSlug: "$slug",
          variantId: "$variants._id",
          sku: "$variants.sku",
          options: "$variants.options",
          stock: "$variants.stock",
          lowStockThreshold: { $literal: threshold },
        },
      },
      { $sort: { stock: 1, productTitle: 1, sku: 1 } },
      { $limit: 500 },
    ]);

    return {
      success: true,
      status: 200,
      code: "LOW_STOCK_VARIANTS_FETCHED",
      data: variants,
    };
  } catch (error) {
    console.error("Low stock query failed:", error);
    return {
      success: false,
      status: 500,
      code: "LOW_STOCK_QUERY_FAILED",
      message: "Could not load low-stock variants",
    };
  }
};
