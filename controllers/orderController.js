import expressAsyncHandler from 'express-async-handler'
import Order from '../models/Order.js'
import ProductFeed from '../models/ProductFeed.js'
import {
  adminEmailPL,
  customerEmailPL,
} from '../utils/templates/emailTemplates.js'
import { sendMail } from '../utils/mailer.js'

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
      totalPrice,
      totalQuantity,
      comment,
      status,
      isPaid,
      email,
    } = req.body

    if (!Array.isArray(basketItems) || basketItems.length === 0) {
      return res.status(400).send({ message: 'basketItems is required' })
    }

    const newOrder = new Order({
      userId: userId || '',
      userInfo: {
        name: userInfo?.name || '',
        phone: userInfo?.phone || '',
        fop: userInfo?.fop || '',
        userDeliv: userInfo?.userDeliv || 'Забираю сам',
      },
      basketItems,
      deliveryMethod: deliveryMethod || 'Самовывоз',
      paymentMethod: paymentMethod || 'Оплата при получении',
      city: city || '',
      address: address || '',
      totalPrice: totalPrice || 0,
      totalQuantity: totalQuantity || 0,
      comment: comment || '',
      status: status || 'Принято',
      isPaid: isPaid || false,
    })

    const order = await newOrder.save()
    if (!order) {
      return res.status(401).send({ message: 'Щось пішло не так!' })
    }

    if (
      order.isPaid === true ||
      order.paymentMethod === 'Оплата при получении'
    ) {
      for (const item of basketItems) {
        await ProductFeed.findOneAndUpdate(
          {
            $or: [
              { position_name_ukr: item.name },
              { position_name: item.name },
            ],
          },
          { $inc: { quantity: -item.quantity } },
          { new: true },
        )
      }
    }

    const adminTo = process.env.ADMIN_EMAIL || 'inbox.vikingcars@gmail.com'

    const tasks = []

    if (email) {
      const c = customerEmailPL({
        name: newOrder.userInfo.name,
        phone: newOrder.userInfo.phone,
        items: basketItems,
        orderId: order._id,
      })
      tasks.push(
        sendMail({ to: email, subject: c.subject, html: c.html, text: c.text }),
      )
    }

    const a = adminEmailPL({
      name: newOrder.userInfo.name,
      phone: newOrder.userInfo.phone,
      items: basketItems,
      orderId: order._id,
    })
    tasks.push(
      sendMail({ to: adminTo, subject: a.subject, html: a.html, text: a.text }),
    )

    Promise.allSettled(tasks).then((results) => {
      results.forEach((r) => {
        if (r.status === 'rejected') {
          console.error(
            '[Mailer] send failed:',
            r.reason?.response || r.reason?.message || r.reason,
          )
        }
      })
    })

    res.status(201).send({ message: 'Заказ успешно создан!', order })
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
      res.send({ message: 'Статус успішно змінено!' })
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
