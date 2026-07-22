import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductFeed from "../models/ProductFeed.js";

dotenv.config();

const migrate = async () => {
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is required");

  await mongoose.connect(process.env.MONGODB_URL);
  const result = await ProductFeed.updateMany(
    { source: { $ne: "admin" } },
    { $set: { source: "ftp" } },
  );
  console.log(
    `Product source migration complete (matched: ${result.matchedCount}, modified: ${result.modifiedCount})`,
  );
};

try {
  await migrate();
} catch (error) {
  console.error("Product source migration failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
