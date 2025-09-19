import expressAsyncHandler from "express-async-handler";
import Order from "../models/OrderOneClick.js";
import ProductFeed from "../models/ProductFeed.js";

export const createOrder = expressAsyncHandler(async (req, res) => {
  try {
    const newOrder = new Order({
      name: req.body.name || "",
      phone: req.body.phone || "",
      userId: req.body.userId || null,
      basketItem: req.body.basketItem || null,
      isPaid: req.body.isPaid || false,
      status: req.body.status || "Принято",
    });

    const order = await newOrder.save();
    if (!order) {
      return res.status(401).send({ message: "Щось пішло не так!" });
    }

    for (const item of [req.body.basketItem]) {
      await ProductFeed.findOneAndUpdate(
        {
          $or: [{ position_name_ukr: item.name }, { position_name: item.name }],
        },
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );
    }

    res.status(201).send({ message: "Заказ успешно создан!" });
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const getOrders = expressAsyncHandler(async (req, res) => {
  try {
    const orders = (await Order.find()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
    res.send(orders);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const getUsersOrders = expressAsyncHandler(async (req, res) => {
  const { userId } = req.params;
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
      res.send({ message: "Такого замовлення не існує!" });
      return;
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
