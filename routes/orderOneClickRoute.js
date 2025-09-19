import express from "express"
import { createOrder, getOrderById, getOrders, getUsersOrders, removeOrder, updateOrderPayment, updateOrderStatus } from "../controllers/orderOneClickController.js"


const orderRouter = express.Router()

orderRouter.post('/', createOrder)

orderRouter.get('/:id', getOrderById)

orderRouter.get("/", getOrders)

orderRouter.get("/user/:userId", getUsersOrders)

orderRouter.put("/updateStatus/:id", updateOrderStatus)

orderRouter.put("/updatePayment/:id", updateOrderPayment)

orderRouter.delete("/:id", removeOrder)

export default orderRouter