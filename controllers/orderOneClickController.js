import expressAsyncHandler from 'express-async-handler'
import Order from '../models/OrderOneClick.js'
import ProductFeed from '../models/ProductFeed.js'
import {
  adminEmailPL,
  customerEmailPL,
} from '../utils/templates/emailTemplates.js'
import { sendMail } from '../utils/mailer.js'

export const createOrder = expressAsyncHandler(async (req, res) => {
  try {
    const {
      name = '',
      phone = '',
      userId = null,
      basketItem = null,
      isPaid = false,
      status = 'Принято',
      email,
    } = req.body

    if (!basketItem) {
      return res.status(400).send({ message: 'basketItem is required' })
    }

    const newOrder = new Order({
      name,
      phone,
      userId,
      basketItem,
      isPaid,
      status,
    })

    const order = await newOrder.save()
    if (!order) {
      return res.status(401).send({ message: 'Щось пішло не так!' })
    }

    await ProductFeed.findOneAndUpdate(
      {
        $or: [
          { position_name_ukr: basketItem.name },
          { position_name: basketItem.name },
        ],
      },
      { $inc: { quantity: -basketItem.quantity } },
      { new: true },
    )

    const adminTo = process.env.ADMIN_EMAIL || 'inbox.vikingcars@gmail.com'
    const items = [basketItem]

    const tasks = []
    if (email) {
      const c = customerEmailPL({ name, phone, items, orderId: order._id })
      tasks.push(
        sendMail({ to: email, subject: c.subject, html: c.html, text: c.text }),
      )
    }

    // E-mail для админа
    const a = adminEmailPL({ name, phone, items, orderId: order._id })
    tasks.push(
      sendMail({ to: adminTo, subject: a.subject, html: a.html, text: a.text }),
    )

    // Не блокируем ответ клиенту — отправляем письма параллельно
    Promise.allSettled(tasks).then((results) => {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(
            '[Mailer] send failed:',
            r.reason?.response || r.reason?.message || r.reason,
          )
        }
      })
    })

    res
      .status(201)
      .send({ message: 'Заказ успешно создан!', orderId: order._id })
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})

export const getOrders = expressAsyncHandler(async (req, res) => {
  try {
    const orders = (await Order.find()).sort(
      (a, b) => b.createdAt - a.createdAt,
    )
    res.send(orders)
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})

export const getUsersOrders = expressAsyncHandler(async (req, res) => {
  const { userId } = req.params
  try {
    const orders = await Order.find({ userId })
    res.send(orders)
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})

export const getOrderById = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ _id: id })

    if (!order) {
      res.send({ message: 'Такого замовлення не існує!' })
      return
    }
    res.send(order)
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})

export const updateOrderStatus = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ _id: id })
    if (order) {
      order.status = req.body.status
      await order.save()
      res.send({ message: 'Статус запроса обновлён!' })
    } else {
      res.send({ message: 'Такого замовлення не існує!' })
    }
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})

export const updateOrderPayment = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const order = await Order.findOne({ _id: id })
    if (order) {
      order.isPaid = req.body.payStatus === 'Оплачено'
      await order.save()
      res.send({ message: 'Статус успішно змінено!' })
    } else {
      res.send({ message: 'Такого ордера нету!' })
    }
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})

export const removeOrder = expressAsyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (order) {
      await order.deleteOne()
      res.send({ message: 'Заказ удален успешно!' })
    } else {
      res.status(404).send({ message: 'Замовлення не знайдено!' })
    }
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})
