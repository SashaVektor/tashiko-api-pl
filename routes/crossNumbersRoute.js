import express from "express";
import { isAdmin, isAuth } from "../utils.js";
import {
  createCrossNumber,
  deleteCrossNumber,
  getAdminCrossNumbers,
  updateCrossNumber,
} from "../controllers/crossNumbersController.js";

const crossNumbersRoute = express.Router();

crossNumbersRoute.get("/", isAuth, isAdmin, getAdminCrossNumbers);
crossNumbersRoute.post("/", isAuth, isAdmin, createCrossNumber);
crossNumbersRoute.put("/:id", isAuth, isAdmin, updateCrossNumber);
crossNumbersRoute.delete("/:id", isAuth, isAdmin, deleteCrossNumber);

export default crossNumbersRoute;
