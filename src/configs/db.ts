import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URL || process.env.MONGO_URI;

  if (!mongoURI) {
    console.error(
      "MongoDB connection string is missing. Set MONGODB_URL or MONGO_URI in your .env file.",
    );
    process.exit(1);
  }

  try {
    const connection = await mongoose.connect(mongoURI);
    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (err) {
    console.error(`Connection failed: ${err}`);
    process.exit(1);
  }
};
