import express from "express";
import { isAdmin, isAuth } from "../utils.js";
import {
  createOrderStatus,
  deleteOrderStatus,
  getOrderStatuses,
  updateOrderStatus,
} from "../controllers/orderStatusController.js";

const orderStatusRoute = express.Router();

orderStatusRoute.get("/", isAuth, isAdmin, getOrderStatuses);
orderStatusRoute.post("/", isAuth, isAdmin, createOrderStatus);
orderStatusRoute.put("/:id", isAuth, isAdmin, updateOrderStatus);
orderStatusRoute.delete("/:id", isAuth, isAdmin, deleteOrderStatus);

export default orderStatusRoute;
