import axios from "axios";
import express from "express";
import Order from "../models/Order.js";

const monobankRoute = express.Router();

monobankRoute.post("/create-monobank-invoice", async (req, res) => {
  const MONOBANK_API_URL =
    "https://api.monobank.ua/api/merchant/invoice/create";
  const MONOBANK_TOKEN = process.env.MONOBANK_TOKEN;

  try {
    const { orderId, amount, description } = req.body;

    const invoiceData = {
      amount,
      ccy: 980,
      merchantPaymInfo: {
        reference: orderId,
        destination: description,
        basketOrder: [
          {
            name: `Заказ ${orderId}`,
            qty: 1,
            sum: amount,
            code: orderId,
          },
        ],
      },
      redirectUrl: "https://tashiko-new-test.netlify.app/checkout-success",
      webHookUrl: `https://tashiko-api-nu.vercel.app/api/monobank/webhook?id=${orderId}`,
      validity: 3600,
      paymentType: "debit",
    };

    const response = await axios.post(MONOBANK_API_URL, invoiceData, {
      headers: {
        "X-Token": MONOBANK_TOKEN,
        "Content-Type": "application/json",
      },
    });

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
  const { invoiceId, status } = req.body;
  console.log(req.body);

  if (status === "success") {
    try {
      const { id } = req.query;
      console.log(id);
      
      const order = await Order.findOne({ _id: id });
      if (order) {
        order.isPaid = true;
        await order.save();
        res.send({ message: "Статус успішно змінено!" });
      } else {
        res.send({ message: "Такого ордера нету!" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "INTERNAL SERVER ERROR" });
    }
  }
  res.sendStatus(200);
});

export default monobankRoute;
