import mongoose from "mongoose";

const orderStatusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isDefault: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const OrderStatus = mongoose.model("OrderStatus", orderStatusSchema);
export default OrderStatus;
