import express from "express";
import { getUsdPlnRate } from "../controllers/exchangeRateController.js";

const exchangeRateRoute = express.Router();

exchangeRateRoute.get("/usd-pln", getUsdPlnRate);

export default exchangeRateRoute;
