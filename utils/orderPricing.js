import { randomUUID } from "node:crypto";
import ProductFeed from "../models/ProductFeed.js";

export class OrderValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const parsePrice = (value) => {
  const price = Number(
    String(value ?? "")
      .replace(/\s/g, "")
      .replace(",", "."),
  );
  if (!Number.isFinite(price) || price < 0) {
    throw new OrderValidationError("Product has an invalid price");
  }
  return price;
};

export const priceOrderItems = async (requestedItems) => {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new OrderValidationError("At least one product is required");
  }

  const normalized = requestedItems.map((item) => {
    const productCode = String(item?.productCode || "").trim();
    const quantity = Number(item?.quantity);
    if (!productCode) throw new OrderValidationError("Product SKU is required");
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new OrderValidationError("Quantity must be a positive integer");
    }
    return {
      id: item?._id,
      requestedName: String(item?.name || "").trim(),
      productCode,
      quantity,
    };
  });

  const codes = [...new Set(normalized.map(({ productCode }) => productCode))];
  const products = await ProductFeed.find({ item_code: { $in: codes } }).lean();
  const productsByCode = new Map(
    products.map((product) => [product.item_code, product]),
  );

  const items = normalized.map(
    ({ id, requestedName, productCode, quantity }) => {
      const product = productsByCode.get(productCode);
      if (!product) {
        throw new OrderValidationError(
          `Product ${productCode} was not found`,
          404,
        );
      }

      const allowedNames = [
        product.position_name,
        product.position_name_ukr,
      ].filter(Boolean);
      return {
        _id: id || randomUUID(),
        productCode,
        name: allowedNames.includes(requestedName)
          ? requestedName
          : product.position_name_ukr || product.position_name || productCode,
        price: Number(parsePrice(product.price).toFixed(2)),
        currency: "PLN",
        imageLink: String(product.link_image || "")
          .split(",")[0]
          .trim(),
        quantity,
        available: Number(product.quantity || 0),
      };
    },
  );

  return {
    items,
    totalPrice: Number(
      items
        .reduce((total, item) => total + item.price * item.quantity, 0)
        .toFixed(2),
    ),
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
  };
};

const quantitiesByCode = (items = []) =>
  items.reduce((result, item) => {
    const code = String(item?.productCode || "").trim();
    if (code)
      result.set(code, (result.get(code) || 0) + Number(item.quantity || 0));
    return result;
  }, new Map());

export const assertStockAvailable = (items) => {
  const requested = quantitiesByCode(items);
  const availability = new Map(
    items.map((item) => [item.productCode, Number(item.available || 0)]),
  );
  for (const [code, quantity] of requested) {
    if (quantity > (availability.get(code) || 0)) {
      throw new OrderValidationError(
        `Insufficient stock for product ${code}`,
        409,
      );
    }
  }
};

export const selectionsMatch = (currentItems, requestedItems) => {
  const current = quantitiesByCode(currentItems);
  const requested = quantitiesByCode(requestedItems);
  return (
    current.size === requested.size &&
    [...current].every(([code, quantity]) => requested.get(code) === quantity)
  );
};

export const applyStockDelta = async (oldItems, newItems) => {
  const oldQuantities = quantitiesByCode(oldItems);
  const newQuantities = quantitiesByCode(newItems);
  const codes = new Set([...oldQuantities.keys(), ...newQuantities.keys()]);
  const applied = [];

  const rollback = async () => {
    for (const { code, delta } of applied.reverse()) {
      await ProductFeed.updateOne(
        { item_code: code },
        { $inc: { quantity: delta } },
      );
    }
  };

  try {
    for (const code of codes) {
      const delta =
        (newQuantities.get(code) || 0) - (oldQuantities.get(code) || 0);
      if (delta === 0) continue;

      const filter =
        delta > 0
          ? { item_code: code, quantity: { $gte: delta } }
          : { item_code: code };
      const product = await ProductFeed.findOneAndUpdate(
        filter,
        { $inc: { quantity: -delta } },
        { new: true },
      );
      if (!product) {
        throw new OrderValidationError(
          `Insufficient stock for product ${code}`,
          409,
        );
      }
      applied.push({ code, delta });
    }
  } catch (error) {
    await rollback();
    throw error;
  }

  return rollback;
};
