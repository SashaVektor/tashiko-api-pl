import dotenv from "dotenv";
import mongoose from "mongoose";
import OrderStatus from "../models/OrderStatus.js";
import PaymentStatus from "../models/PaymentStatus.js";
import Order from "../models/Order.js";
import OrderOneClick from "../models/OrderOneClick.js";

dotenv.config();

const DEFAULT_STATUS_NAME = "Принято";
const COMPLETED_STATUS_NAMES = new Set(["Доставлено", "Завершено"]);

const PAYMENT_STATUSES = [
  { name: "Не оплачено", isDefault: true, countsAsPaid: false, sortOrder: 1 },
  { name: "Оплачено", isDefault: false, countsAsPaid: true, sortOrder: 2 },
];

const migrate = async () => {
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is required");

  await mongoose.connect(process.env.MONGODB_URL);

  const [orderStatusNames, oneClickStatusNames] = await Promise.all([
    Order.distinct("status"),
    OrderOneClick.distinct("status"),
  ]);
  const discoveredNames = [
    ...new Set(
      [...orderStatusNames, ...oneClickStatusNames]
        .map((name) => String(name || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!discoveredNames.includes(DEFAULT_STATUS_NAME)) {
    discoveredNames.unshift(DEFAULT_STATUS_NAME);
  }

  for (const [index, name] of discoveredNames.entries()) {
    await OrderStatus.updateOne(
      { name },
      {
        $setOnInsert: {
          name,
          isDefault: name === DEFAULT_STATUS_NAME,
          isCompleted: COMPLETED_STATUS_NAMES.has(name),
          sortOrder: index + 1,
        },
      },
      { upsert: true },
    );
  }

  for (const status of PAYMENT_STATUSES) {
    await PaymentStatus.updateOne(
      { name: status.name },
      { $setOnInsert: status },
      { upsert: true },
    );
  }

  const [orderResult, oneClickResult] = await Promise.all([
    Order.updateMany(
      { paymentStatus: { $exists: false } },
      [
        {
          $set: {
            paymentStatus: {
              $cond: ["$isPaid", "Оплачено", "Не оплачено"],
            },
          },
        },
      ],
    ),
    OrderOneClick.updateMany(
      { paymentStatus: { $exists: false } },
      [
        {
          $set: {
            paymentStatus: {
              $cond: ["$isPaid", "Оплачено", "Не оплачено"],
            },
          },
        },
      ],
    ),
  ]);

  console.log(
    `Discovered order statuses: ${discoveredNames.join(", ")}.`,
  );
  console.log(
    `Seeded order/payment statuses. Backfilled paymentStatus on ${orderResult.modifiedCount} orders and ${oneClickResult.modifiedCount} one-click orders.`,
  );
};

try {
  await migrate();
} catch (error) {
  console.error("Order/payment status seed migration failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
