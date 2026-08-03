import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductFeed from "../models/ProductFeed.js";

dotenv.config();

const migrate = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  try {
    const duplicates = await ProductFeed.aggregate([
      { $match: { item_code: { $type: "string", $gt: "" } } },
      {
        $group: {
          _id: "$item_code",
          count: { $sum: 1 },
          productIds: { $push: "$_id" },
          sources: { $push: "$source" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    if (duplicates.length) {
      console.error(
        "Duplicate SKUs must be resolved before the unique index can be created:",
      );
      duplicates.forEach((duplicate) => {
        console.error(
          JSON.stringify({
            itemCode: duplicate._id,
            productIds: duplicate.productIds,
            sources: duplicate.sources,
          }),
        );
      });
      process.exitCode = 1;
      return;
    }

    await ProductFeed.updateMany({}, { $set: { currency: "PLN" } });
    await ProductFeed.updateMany(
      { active: { $exists: false } },
      { $set: { active: true } },
    );
    await ProductFeed.collection.createIndex(
      { item_code: 1 },
      {
        unique: true,
        name: "unique_product_item_code",
        partialFilterExpression: {
          item_code: { $type: "string", $gt: "" },
        },
      },
    );
    console.log("Pricing fields updated and unique SKU index created.");
  } finally {
    await mongoose.disconnect();
  }
};

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
