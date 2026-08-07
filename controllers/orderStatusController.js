import expressAsyncHandler from "express-async-handler";
import OrderStatus from "../models/OrderStatus.js";
import Order from "../models/Order.js";
import OrderOneClick from "../models/OrderOneClick.js";

const normalizeName = (value) => String(value ?? "").trim();

export const getOrderStatuses = expressAsyncHandler(async (req, res) => {
  const statuses = await OrderStatus.find().sort({ sortOrder: 1, createdAt: 1 });
  res.status(200).json(statuses);
});

export const createOrderStatus = expressAsyncHandler(async (req, res) => {
  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ message: "Name is required" });
  if (await OrderStatus.exists({ name })) {
    return res
      .status(409)
      .json({ message: "A status with this name already exists" });
  }

  const isDefault = Boolean(req.body.isDefault);
  if (isDefault) {
    await OrderStatus.updateMany({}, { $set: { isDefault: false } });
  }

  const status = await OrderStatus.create({
    name,
    isDefault,
    isCompleted: Boolean(req.body.isCompleted),
    sortOrder: Number(req.body.sortOrder) || 0,
  });
  res.status(201).json(status);
});

export const updateOrderStatus = expressAsyncHandler(async (req, res) => {
  const status = await OrderStatus.findById(req.params.id);
  if (!status) return res.status(404).json({ message: "Status not found" });

  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ message: "Name is required" });
  const duplicate = await OrderStatus.exists({
    name,
    _id: { $ne: status._id },
  });
  if (duplicate) {
    return res
      .status(409)
      .json({ message: "A status with this name already exists" });
  }

  const previousName = status.name;
  const isDefault = Boolean(req.body.isDefault);
  if (isDefault && !status.isDefault) {
    await OrderStatus.updateMany(
      { _id: { $ne: status._id } },
      { $set: { isDefault: false } },
    );
  }

  status.name = name;
  status.isDefault = isDefault;
  status.isCompleted = Boolean(req.body.isCompleted);
  status.sortOrder = Number(req.body.sortOrder) || 0;
  await status.save();

  if (previousName !== name) {
    await Promise.all([
      Order.updateMany({ status: previousName }, { $set: { status: name } }),
      OrderOneClick.updateMany(
        { status: previousName },
        { $set: { status: name } },
      ),
    ]);
  }

  res.status(200).json(status);
});

export const deleteOrderStatus = expressAsyncHandler(async (req, res) => {
  const status = await OrderStatus.findById(req.params.id);
  if (!status) return res.status(404).json({ message: "Status not found" });

  const [ordersCount, oneClickCount] = await Promise.all([
    Order.countDocuments({ status: status.name }),
    OrderOneClick.countDocuments({ status: status.name }),
  ]);
  const totalInUse = ordersCount + oneClickCount;
  if (totalInUse > 0) {
    return res.status(409).json({
      message: `Cannot delete: ${totalInUse} order(s) currently use this status`,
    });
  }

  await status.deleteOne();
  res.status(200).json({ message: "Status deleted" });
});
