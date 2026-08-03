import expressAsyncHandler from "express-async-handler";
import {
  assertStockAvailable,
  OrderValidationError,
  priceOrderItems,
} from "../utils/orderPricing.js";

export const quoteCart = expressAsyncHandler(async (req, res) => {
  try {
    const priced = await priceOrderItems(req.body.items);
    assertStockAvailable(priced.items);
    res.send({
      ...priced,
      currency: "PLN",
      quotedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return res.status(error.status).send({ message: error.message });
    }
    console.error("[Pricing quote]", error);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const getPricingConfig = expressAsyncHandler(async (req, res) => {
  res.send({
    market: "PL",
    baseCurrencies: ["PLN"],
    resolvedCurrency: "PLN",
    exchangeRate: null,
  });
});
