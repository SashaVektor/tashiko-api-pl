import axios from "axios";
import express from "express";
import Order from "../models/Order.js";
import { verifyMonobankSignature } from "../utils/monobankSignature.js";

const monobankRoute = express.Router();

monobankRoute.post("/create-monobank-invoice", async (req, res) => {
  const MONOBANK_API_URL =
    "https://api.monobank.ua/api/merchant/invoice/create";
  const MONOBANK_TOKEN = process.env.MONOBANK_TOKEN;

  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.isPaid) {
      return res.status(409).json({ error: "Order is already paid" });
    }
    if (
      !Number.isFinite(order.totalPrice) ||
      order.totalPrice <= 0 ||
      order.basketItems.some((item) => item.currency !== "UAH")
    ) {
      return res.status(422).json({
        error: "Monobank only supports UAH orders; use the PL payment provider",
      });
    }
    const amount = Math.round(order.totalPrice * 100);
    const description = `Замовлення #${order._id}`;

    const invoiceData = {
      amount,
      ccy: 980,
      merchantPaymInfo: {
        reference: String(order._id),
        destination: description,
        basketOrder: [
          {
            name: `Заказ ${order._id}`,
            qty: 1,
            sum: amount,
            code: String(order._id),
          },
        ],
      },
      redirectUrl: `${(process.env.FE_ORIGIN || "http://localhost:5173").replace(/\/$/, "")}/checkout-success`,
      webHookUrl: `${process.env.PUBLIC_API_URL}/api/monobank/webhook`,
      validity: 3600,
      paymentType: "debit",
    };

    const response = await axios.post(MONOBANK_API_URL, invoiceData, {
      headers: {
        "X-Token": MONOBANK_TOKEN,
        "Content-Type": "application/json",
      },
    });
    order.payment = {
      provider: "monobank",
      invoiceId: response.data.invoiceId,
    };
    await order.save();

    res.json({
      invoiceUrl: response.data.pageUrl,
      invoiceId: response.data.invoiceId,
    });
  } catch (error) {
    console.error("Monobank error:", error.response?.data);
    res.status(500).json({ error: "Payment processing failed" });
  }
});

monobankRoute.post("/webhook", async (req, res) => {
  const signature = req.headers["x-sign"];
  const signatureValid = await verifyMonobankSignature(
    req.rawBody,
    signature,
  ).catch((error) => {
    console.error("[Monobank] Signature verification error:", error.message);
    return false;
  });
  if (!signatureValid) {
    console.error("[Monobank] Rejected webhook with invalid signature");
    return res.status(401).json({ message: "Invalid signature" });
  }

  const { amount, invoiceId, reference, status } = req.body;

  if (status === "success") {
    try {
      const order = await Order.findOne({
        "payment.provider": "monobank",
        "payment.invoiceId": invoiceId,
      });
      if (order) {
        if (
          String(reference || "") !== String(order._id) ||
          Number(amount) !== Math.round(order.totalPrice * 100)
        ) {
          return res.status(400).send({ message: "Payment amount mismatch" });
        }
        order.isPaid = true;
        await order.save();
        return res.send({ message: "Статус успішно змінено!" });
      } else {
        return res.status(404).send({ message: "Такого ордера нету!" });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).send({ message: "INTERNAL SERVER ERROR" });
    }
  }
  return res.sendStatus(200);
});

export default monobankRoute;
