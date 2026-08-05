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
  if (!Number.isFinite(price) || price <= 0) {
    throw new OrderValidationError("Product price is unavailable", 422);
  }
  return price;
};

const resolveProductPrice = (product) => {
  const basePrice = parsePrice(product.price);
  return {
    basePrice,
    baseCurrency: "PLN",
    resolvedPrice: Number(basePrice.toFixed(2)),
    resolvedCurrency: "PLN",
  };
};

export const enrichProductsWithPricing = async (products) =>
  products.map((product) => {
    const plain =
      typeof product?.toObject === "function" ? product.toObject() : product;
    try {
      const pricing = resolveProductPrice(plain);
      return { ...plain, ...pricing, priceAvailable: plain.active !== false };
    } catch {
      return {
        ...plain,
        basePrice: null,
        baseCurrency: "PLN",
        resolvedPrice: null,
        resolvedCurrency: "PLN",
        priceAvailable: false,
      };
    }
  });

export const priceOrderItems = async (requestedItems) => {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new OrderValidationError("At least one product is required");
  }
  if (requestedItems.length > 100) {
    throw new OrderValidationError("No more than 100 products are allowed");
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
  const productsByCode = new Map();
  for (const product of products) {
    if (productsByCode.has(product.item_code)) {
      throw new OrderValidationError(
        `Duplicate product configuration for SKU ${product.item_code}`,
        409,
      );
    }
    productsByCode.set(product.item_code, product);
  }

  const items = normalized.map(
    ({ id, requestedName, productCode, quantity }) => {
      const product = productsByCode.get(productCode);
      if (!product) {
        throw new OrderValidationError(
          `Product ${productCode} was not found`,
          404,
        );
      }
      if (product.active === false) {
        throw new OrderValidationError(
          `Product ${productCode} is unavailable`,
          409,
        );
      }

      const pricing = resolveProductPrice(product);
      return {
        _id: id || randomUUID(),
        productCode,
        name:
          requestedName === product.position_name
            ? requestedName
            : product.position_name || productCode,
        price: pricing.resolvedPrice,
        currency: pricing.resolvedCurrency,
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
