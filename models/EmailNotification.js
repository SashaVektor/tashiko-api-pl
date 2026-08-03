import mongoose from "mongoose";

const emailNotificationSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, trim: true, index: true },
    relatedId: { type: String, trim: true, default: "" },
    to: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    html: { type: String, default: "" },
    text: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedUntil: { type: Date, default: () => new Date(0) },
    lockToken: { type: String, default: "" },
    lastAttemptAt: { type: Date },
    sentAt: { type: Date },
    lastError: { type: String, default: "" },
  },
  { timestamps: true },
);

emailNotificationSchema.index({ status: 1, nextAttemptAt: 1 });

const EmailNotification = mongoose.model(
  "EmailNotification",
  emailNotificationSchema,
);

export default EmailNotification;
