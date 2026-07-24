import express from "express";
import {
  getPricingConfig,
  quoteCart,
} from "../controllers/pricingController.js";

const pricingRoute = express.Router();

pricingRoute.get("/config", getPricingConfig);
pricingRoute.post("/quote", quoteCart);

export default pricingRoute;
