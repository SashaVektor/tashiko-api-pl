import { randomUUID } from "node:crypto";
import EmailNotification from "../models/EmailNotification.js";
import { sendMail } from "../utils/mailer.js";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_MINUTES = 5;
const DEFAULT_BATCH_SIZE = 20;
const LOCK_DURATION_MS = 5 * 60 * 1000;

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const maxAttempts = () =>
  positiveInteger(process.env.EMAIL_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS);

const retryDelayMs = (attempt) => {
  const baseMinutes = positiveInteger(
    process.env.EMAIL_RETRY_BASE_MINUTES,
    DEFAULT_RETRY_BASE_MINUTES,
  );
  return Math.min(baseMinutes * 2 ** Math.max(attempt - 1, 0), 24 * 60) * 60000;
};

const errorMessage = (error) =>
  String(error?.response || error?.message || error || "Unknown mail error").slice(
    0,
    2000,
  );

const claimNotification = (id) => {
  const now = new Date();
  return EmailNotification.findOneAndUpdate(
    {
      _id: id,
      $or: [
        { status: "pending", nextAttemptAt: { $lte: now } },
        { status: "processing", lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "processing",
        lockToken: randomUUID(),
        lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
        lastAttemptAt: now,
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
};

export const deliverEmailNotification = async (id) => {
  const notification = await claimNotification(id);
  if (!notification) return null;

  try {
    await sendMail({
      to: notification.to,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
    });
    await EmailNotification.updateOne(
      { _id: notification._id, lockToken: notification.lockToken },
      {
        $set: {
          status: "sent",
          sentAt: new Date(),
          lastError: "",
          lockToken: "",
          lockedUntil: new Date(0),
        },
      },
    );
    return { id: notification._id, status: "sent" };
  } catch (error) {
    const terminal = notification.attempts >= notification.maxAttempts;
    await EmailNotification.updateOne(
      { _id: notification._id, lockToken: notification.lockToken },
      {
        $set: {
          status: terminal ? "failed" : "pending",
          nextAttemptAt: terminal
            ? notification.nextAttemptAt
            : new Date(Date.now() + retryDelayMs(notification.attempts)),
          lastError: errorMessage(error),
          lockToken: "",
          lockedUntil: new Date(0),
        },
      },
    );

    const deliveryError = new Error(errorMessage(error));
    deliveryError.notificationId = String(notification._id);
    throw deliveryError;
  }
};

export const queueEmailAndAttempt = async (message) => {
  const notification = await EmailNotification.create({
    ...message,
    maxAttempts: maxAttempts(),
  });
  return deliverEmailNotification(notification._id);
};

export const queueEmailsAndAttempt = (messages) =>
  Promise.allSettled(messages.map((message) => queueEmailAndAttempt(message)));

export const processEmailOutbox = async (requestedLimit) => {
  const limit = Math.min(
    positiveInteger(
      requestedLimit || process.env.EMAIL_OUTBOX_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
    ),
    100,
  );
  const now = new Date();
  const notifications = await EmailNotification.find({
    $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "processing", lockedUntil: { $lte: now } },
    ],
  })
    .sort({ nextAttemptAt: 1, createdAt: 1 })
    .limit(limit)
    .select("_id")
    .lean();
  const results = await Promise.allSettled(
    notifications.map(({ _id }) => deliverEmailNotification(_id)),
  );

  return {
    processed: results.length,
    sent: results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length,
    deferred: results.filter(
      (result) => result.status === "fulfilled" && !result.value,
    ).length,
    failedAttempts: results.filter((result) => result.status === "rejected")
      .length,
  };
};

export const logEmailResults = (results, context) => {
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(`[Mailer] ${context} delivery failed:`, result.reason);
    }
  });
};
