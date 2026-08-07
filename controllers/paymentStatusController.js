import expressAsyncHandler from "express-async-handler";
import PaymentStatus from "../models/PaymentStatus.js";
import Order from "../models/Order.js";
import OrderOneClick from "../models/OrderOneClick.js";

const normalizeName = (value) => String(value ?? "").trim();

export const getPaymentStatuses = expressAsyncHandler(async (req, res) => {
  const statuses = await PaymentStatus.find().sort({
    sortOrder: 1,
    createdAt: 1,
  });
  res.status(200).json(statuses);
});

export const createPaymentStatus = expressAsyncHandler(async (req, res) => {
  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ message: "Name is required" });
  if (await PaymentStatus.exists({ name })) {
    return res
      .status(409)
      .json({ message: "A status with this name already exists" });
  }

  const isDefault = Boolean(req.body.isDefault);
  if (isDefault) {
    await PaymentStatus.updateMany({}, { $set: { isDefault: false } });
  }

  const status = await PaymentStatus.create({
    name,
    isDefault,
    countsAsPaid: Boolean(req.body.countsAsPaid),
    sortOrder: Number(req.body.sortOrder) || 0,
  });
  res.status(201).json(status);
});

export const updatePaymentStatus = expressAsyncHandler(async (req, res) => {
  const status = await PaymentStatus.findById(req.params.id);
  if (!status) return res.status(404).json({ message: "Status not found" });

  const name = normalizeName(req.body.name);
  if (!name) return res.status(400).json({ message: "Name is required" });
  const duplicate = await PaymentStatus.exists({
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
    await PaymentStatus.updateMany(
      { _id: { $ne: status._id } },
      { $set: { isDefault: false } },
    );
  }

  const countsAsPaid = Boolean(req.body.countsAsPaid);
  status.name = name;
  status.isDefault = isDefault;
  status.countsAsPaid = countsAsPaid;
  status.sortOrder = Number(req.body.sortOrder) || 0;
  await status.save();

  if (previousName !== name) {
    await Promise.all([
      Order.updateMany(
        { paymentStatus: previousName },
        { $set: { paymentStatus: name, isPaid: countsAsPaid } },
      ),
      OrderOneClick.updateMany(
        { paymentStatus: previousName },
        { $set: { paymentStatus: name, isPaid: countsAsPaid } },
      ),
    ]);
  } else {
    await Promise.all([
      Order.updateMany(
        { paymentStatus: name },
        { $set: { isPaid: countsAsPaid } },
      ),
      OrderOneClick.updateMany(
        { paymentStatus: name },
        { $set: { isPaid: countsAsPaid } },
      ),
    ]);
  }

  res.status(200).json(status);
});

export const deletePaymentStatus = expressAsyncHandler(async (req, res) => {
  const status = await PaymentStatus.findById(req.params.id);
  if (!status) return res.status(404).json({ message: "Status not found" });

  const [ordersCount, oneClickCount] = await Promise.all([
    Order.countDocuments({ paymentStatus: status.name }),
    OrderOneClick.countDocuments({ paymentStatus: status.name }),
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
