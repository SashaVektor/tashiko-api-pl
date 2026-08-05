import express from "express";
import { isAdmin, isAuth } from "../utils.js";
import {
  createPaymentStatus,
  deletePaymentStatus,
  getPaymentStatuses,
  updatePaymentStatus,
} from "../controllers/paymentStatusController.js";

const paymentStatusRoute = express.Router();

paymentStatusRoute.get("/", isAuth, isAdmin, getPaymentStatuses);
paymentStatusRoute.post("/", isAuth, isAdmin, createPaymentStatus);
paymentStatusRoute.put("/:id", isAuth, isAdmin, updatePaymentStatus);
paymentStatusRoute.delete("/:id", isAuth, isAdmin, deletePaymentStatus);

export default paymentStatusRoute;
