import mongoose from "mongoose";

const syncConflictSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const invalidRowSchema = new mongoose.Schema(
  {
    lineNumber: { type: Number, required: true },
    itemCode: { type: String, default: "" },
    reason: { type: String, required: true },
    quantity: { type: String, default: "" },
    price: { type: String, default: "" },
  },
  { _id: false },
);

const productSyncRunSchema = new mongoose.Schema(
  {
    trigger: { type: String, enum: ["admin", "cron"], required: true },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      required: true,
    },
    fileName: { type: String, required: true },
    fileModifiedAt: { type: Date },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    totalRows: { type: Number, default: 0 },
    createdCount: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    disabledCount: { type: Number, default: 0 },
    zeroPriceCount: { type: Number, default: 0 },
    invalidRowCount: { type: Number, default: 0 },
    invalidRows: { type: [invalidRowSchema], default: [] },
    conflictCount: { type: Number, default: 0 },
    conflicts: { type: [syncConflictSchema], default: [] },
    error: { type: String, default: "" },
  },
  { timestamps: true },
);

const ProductSyncRun = mongoose.model("ProductSyncRun", productSyncRunSchema);

export default ProductSyncRun;
