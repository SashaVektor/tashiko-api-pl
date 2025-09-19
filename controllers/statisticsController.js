import expressAsyncHandler from "express-async-handler";
import ProductFeed from "../models/ProductFeed.js";
import Order from "../models/Order.js";
import OrderOneClick from "../models/OrderOneClick.js";
import User from "../models/User.js";
import VINRequest from "../models/VINRequest.js";
import Location from "../models/Location.js";

export const getStatistics = expressAsyncHandler(async (req, res) => {
  try {
    const totalProducts = await ProductFeed.countDocuments();

    const totalOrders = await Order.countDocuments();

    const totalOrdersOneClick = await OrderOneClick.countDocuments();

    const totalUsers = await User.countDocuments();

    const totalRequests = await VINRequest.countDocuments();

    const totalLocations = await Location.countDocuments();

    const orderTotal = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalOrderSum = orderTotal.length > 0 ? orderTotal[0].total : 0;

    const orderOneClickTotal = await OrderOneClick.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalOrderOneClickSum =
      orderOneClickTotal.length > 0 ? orderOneClickTotal[0].total : 0;

    const totalRevenue = totalOrderSum + totalOrderOneClickSum;

    const paidOrdersCount = await Order.countDocuments({ isPaid: true });

    const paidOrdersOneClickCount = await OrderOneClick.countDocuments({
      isPaid: true,
    });

    const totalPaidOrders = paidOrdersCount + paidOrdersOneClickCount;

    const deliveredOrdersCount = await Order.countDocuments({
      status: "Доставлено",
    });

    const completedOrdersOneClickCount = await OrderOneClick.countDocuments({
      status: "Завершено",
    });

    const totalCompletedOrders =
      deliveredOrdersCount + completedOrdersOneClickCount;

    res.status(200).send({
      totalLocations,
      totalOrders,
      totalOrdersOneClick,
      totalProducts,
      totalRequests,
      totalUsers,
      totalRevenue, 
      totalPaidOrders,
      totalCompletedOrders,
    });
  } catch (err) {
    res.status(500).send({
      message: "Помилка при отриманні статистики.",
      error: err.message,
    });
  }
});
