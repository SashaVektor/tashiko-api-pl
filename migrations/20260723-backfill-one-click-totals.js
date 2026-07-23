import dotenv from "dotenv";
import mongoose from "mongoose";
import OrderOneClick from "../models/OrderOneClick.js";

dotenv.config();

const migrate = async () => {
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is required");
  await mongoose.connect(process.env.MONGODB_URL);

  const result = await OrderOneClick.updateMany(
    {
      $or: [
        { totalPrice: { $exists: false } },
        { totalQuantity: { $exists: false } },
      ],
    },
    [
      {
        $set: {
          totalQuantity: { $ifNull: ["$basketItem.quantity", 0] },
          totalPrice: {
            $multiply: [
              { $ifNull: ["$basketItem.price", 0] },
              { $ifNull: ["$basketItem.quantity", 0] },
            ],
          },
        },
      },
    ],
  );

  console.log(
    `One-click totals migration complete (matched: ${result.matchedCount}, modified: ${result.modifiedCount})`,
  );
};

try {
  await migrate();
} catch (error) {
  console.error("One-click totals migration failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
