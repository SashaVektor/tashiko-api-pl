import mongoose from "mongoose";

const paymentStatusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isDefault: { type: Boolean, default: false },
    countsAsPaid: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const PaymentStatus = mongoose.model("PaymentStatus", paymentStatusSchema);
export default PaymentStatus;
