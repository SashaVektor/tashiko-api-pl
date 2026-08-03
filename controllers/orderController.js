import expressAsyncHandler from "express-async-handler";
import Order from "../models/Order.js";
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
      userId,
      userInfo,
      basketItems,
      deliveryMethod,
      paymentMethod,
      city,
      address,
      comment,
      email,
    } = req.body;
    if (
      !String(userInfo?.name || "").trim() ||
      !String(userInfo?.phone || "").trim()
    ) {
      throw new OrderValidationError("Recipient name and phone are required");
    }
    const priced = await priceOrderItems(basketItems);
    const resolvedPaymentMethod = paymentMethod || "Оплата при получении";
    assertStockAvailable(priced.items);

    const newOrder = new Order({
      userId: userId || "",
      userInfo: {
        name: userInfo?.name || "",
        phone: userInfo?.phone || "",
        fop: userInfo?.fop || "",
        userDeliv: userInfo?.userDeliv || "Забираю сам",
      },
      basketItems: priced.items,
      deliveryMethod: deliveryMethod || "Самовывоз",
      paymentMethod: resolvedPaymentMethod,
      city: city || "",
      address: address || "",
      totalPrice: priced.totalPrice,
      totalQuantity: priced.totalQuantity,
      comment: comment || "",
      status: "Принято",
      isPaid: false,
    });

    const order = await newOrder.save();

    res.status(201).send({ message: "Заказ успешно создан!", order });

    sendOrderNotificationEmails({
      kindPrefix: "regular-order",
      orderId: order._id,
      name: newOrder.userInfo.name,
      phone: newOrder.userInfo.phone,
      email,
      items: priced.items,
      details: {
        recipient: newOrder.userInfo.userDeliv,
        company: newOrder.userInfo.fop,
        deliveryMethod: newOrder.deliveryMethod,
        city: newOrder.city,
        address: newOrder.address,
        paymentMethod: newOrder.paymentMethod,
        isPaid: newOrder.isPaid,
        comment: newOrder.comment,
        totalPrice: newOrder.totalPrice,
        totalQuantity: newOrder.totalQuantity,
        currency: priced.items[0]?.currency || "PLN",
      },
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

    const requestedItems = req.body.basketItems;
    if (
      order.isPaid &&
      Array.isArray(requestedItems) &&
      !selectionsMatch(order.basketItems, requestedItems)
    ) {
      return res.status(409).send({
        message: "Products and quantities cannot be changed for a paid order",
      });
    }

    if (
      !order.isPaid &&
      Array.isArray(requestedItems) &&
      !selectionsMatch(order.basketItems, requestedItems)
    ) {
      const priced = await priceOrderItems(requestedItems);
      assertStockAvailable(priced.items);
      order.basketItems = priced.items;
      order.totalPrice = priced.totalPrice;
      order.totalQuantity = priced.totalQuantity;
    }

    if (req.body.userInfo) {
      for (const field of ["name", "phone", "userDeliv"]) {
        if (Object.hasOwn(req.body.userInfo, field)) {
          order.userInfo[field] = String(req.body.userInfo[field] || "").trim();
        }
      }
    }
    if (!order.userInfo.name.trim() || !order.userInfo.phone.trim()) {
      throw new OrderValidationError("Recipient name and phone are required");
    }
    for (const field of ["deliveryMethod", "city", "address", "comment"]) {
      if (Object.hasOwn(req.body, field)) {
        order[field] = String(req.body[field] || "").trim();
      }
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
  const authenticatedUserId = req.user._id.toString();
  const requestedUserId = userId.toString();

  if (req.user.status !== "adm" && authenticatedUserId !== requestedUserId) {
    return res.status(403).send({ message: "Forbidden" });
  }
  try {
    const orders = await Order.find({ userId: requestedUserId });
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
      res.send({ message: "Статус успішно змінено!" });
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
