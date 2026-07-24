import express from "express";
import {
  createOrder,
  editOrder,
  getOrderById,
  getOrders,
  getUsersOrders,
  removeOrder,
  updateOrderPayment,
  updateOrderStatus,
} from "../controllers/orderOneClickController.js";
import { isAdmin, isAuth } from "../utils.js";

const orderRouter = express.Router();

orderRouter.post("/", createOrder);
orderRouter.get("/user/:userId", isAuth, getUsersOrders);
orderRouter.get("/", isAuth, isAdmin, getOrders);
orderRouter.put("/updateStatus/:id", isAuth, isAdmin, updateOrderStatus);
orderRouter.put("/updatePayment/:id", isAuth, isAdmin, updateOrderPayment);
orderRouter.patch("/:id", isAuth, isAdmin, editOrder);
orderRouter.delete("/:id", isAuth, isAdmin, removeOrder);
orderRouter.get("/:id", isAuth, isAdmin, getOrderById);

export default orderRouter;
