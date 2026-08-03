import mongoose from "mongoose";

const productSyncLockSchema = new mongoose.Schema(
  {
    _id: { type: String },
    token: { type: String, default: "" },
    lockedUntil: { type: Date, required: true },
  },
  { versionKey: false },
);

const ProductSyncLock = mongoose.model(
  "ProductSyncLock",
  productSyncLockSchema,
);

export default ProductSyncLock;
