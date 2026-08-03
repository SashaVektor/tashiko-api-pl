import expressAsyncHandler from "express-async-handler";
import Order from "../models/OrderOneClick.js";
import { sendOrderNotificationEmails } from "../services/orderNotifications.js";
import {
  assertStockAvailable,
  OrderValidationError,
  priceOrderItems,
  selectionsMatch,
} from "../utils/orderPricing.js";

export const createOrder = expressAsyncHandler(async (req, res) => {
  try {
    const {
      name = "",
      phone = "",
      userId = null,
      basketItem = null,
      email,
    } = req.body;

    if (!String(name).trim() || !String(phone).trim()) {
      throw new OrderValidationError("Recipient name and phone are required");
    }
    const priced = await priceOrderItems([basketItem]);
    assertStockAvailable(priced.items);

    const newOrder = new Order({
      name,
      phone,
      userId,
      basketItem: priced.items[0],
      totalPrice: priced.totalPrice,
      totalQuantity: priced.totalQuantity,
      isPaid: false,
      status: "Принято",
    });

    const order = await newOrder.save();

    res
      .status(201)
      .send({ message: "Заказ успешно создан!", orderId: order._id, order });

    sendOrderNotificationEmails({
      kindPrefix: "one-click-order",
      orderId: order._id,
      name,
      phone,
      email,
      items: priced.items,
    });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return res.status(error.status).send({ message: error.message });
    }
    console.log(error);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const editOrder = expressAsyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send({ message: "Order not found" });

    const requestedItem = req.body.basketItem;
    if (
      order.isPaid &&
      requestedItem &&
      !selectionsMatch([order.basketItem], [requestedItem])
    ) {
      return res.status(409).send({
        message: "Product and quantity cannot be changed for a paid order",
      });
    }

    if (
      !order.isPaid &&
      requestedItem &&
      !selectionsMatch([order.basketItem], [requestedItem])
    ) {
      const priced = await priceOrderItems([requestedItem]);
      assertStockAvailable(priced.items);
      order.basketItem = priced.items[0];
      order.totalPrice = priced.totalPrice;
      order.totalQuantity = priced.totalQuantity;
    }

    for (const field of [
      "name",
      "phone",
      "deliveryMethod",
      "city",
      "address",
      "comment",
    ]) {
      if (Object.hasOwn(req.body, field)) {
        order[field] = String(req.body[field] || "").trim();
      }
    }
    if (!order.name.trim() || !order.phone.trim()) {
      throw new OrderValidationError("Recipient name and phone are required");
    }

    await order.save();
    res.send({ message: "Order updated successfully", order });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return res.status(error.status).send({ message: error.message });
    }
    console.log(error);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const getOrders = expressAsyncHandler(async (req, res) => {
  try {
    const orders = (await Order.find()).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
    res.send(orders);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const getUsersOrders = expressAsyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (req.user.status !== "adm" && req.user._id !== userId) {
    return res.status(403).send({ message: "Forbidden" });
  }
  try {
    const orders = await Order.find({ userId });
    res.send(orders);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const getOrderById = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({ _id: id });

    if (!order) {
      return res.status(404).send({ message: "Такого замовлення не існує!" });
    }
    res.send(order);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const updateOrderStatus = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({ _id: id });
    if (order) {
      order.status = req.body.status;
      await order.save();
      res.send({ message: "Статус запроса обновлён!" });
    } else {
      res.send({ message: "Такого замовлення не існує!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const updateOrderPayment = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findOne({ _id: id });
    if (order) {
      order.isPaid = req.body.payStatus === "Оплачено";
      await order.save();
      res.send({ message: "Статус успішно змінено!" });
    } else {
      res.send({ message: "Такого ордера нету!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const removeOrder = expressAsyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (order) {
      await order.deleteOne();
      res.send({ message: "Заказ удален успешно!" });
    } else {
      res.status(404).send({ message: "Замовлення не знайдено!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});
