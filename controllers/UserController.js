import expressAsyncHandler from 'express-async-handler'
import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { generateToken } from '../utils.js'
import { sendMail } from '../utils/mailer.js'
import { welcomeEmailPL } from '../utils/templates/customerEmailTemplates.js'
import Order from '../models/Order.js'
import OrderOneClick from '../models/OrderOneClick.js'

const escapeRegExp = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const regularOrdersCollection = Order.collection.name
const oneClickOrdersCollection = OrderOneClick.collection.name

export const getAdminCustomers = expressAsyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
    100,
  )
  const query = String(req.query.q || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 100)
  const orderFilter = ['with', 'without'].includes(req.query.orders)
    ? req.query.orders
    : 'all'
  const sortOptions = {
    newest: { createdAt: -1, _id: 1 },
    oldest: { createdAt: 1, _id: 1 },
    'name-asc': { name: 1, _id: 1 },
    'name-desc': { name: -1, _id: 1 },
    'orders-desc': { orderCount: -1, createdAt: -1 },
    'orders-asc': { orderCount: 1, createdAt: -1 },
  }
  const sort = sortOptions[req.query.sort] || sortOptions.newest
  const filter = { status: { $ne: 'adm' } }
  if (query) {
    const regex = new RegExp(escapeRegExp(query), 'i')
    filter.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { fop: regex },
    ]
  }
  const orderCountMatch =
    orderFilter === 'with'
      ? { orderCount: { $gt: 0 } }
      : orderFilter === 'without'
        ? { orderCount: 0 }
        : {}
  const [result] = await User.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: regularOrdersCollection,
        let: { customerId: { $toString: '$_id' } },
        pipeline: [
          { $match: { $expr: { $eq: ['$userId', '$$customerId'] } } },
          { $count: 'count' },
        ],
        as: 'regularOrderStats',
      },
    },
    {
      $lookup: {
        from: oneClickOrdersCollection,
        let: { customerId: { $toString: '$_id' } },
        pipeline: [
          { $match: { $expr: { $eq: ['$userId', '$$customerId'] } } },
          { $count: 'count' },
        ],
        as: 'oneClickOrderStats',
      },
    },
    {
      $addFields: {
        orderCount: {
          $add: [
            { $ifNull: [{ $first: '$regularOrderStats.count' }, 0] },
            { $ifNull: [{ $first: '$oneClickOrderStats.count' }, 0] },
          ],
        },
      },
    },
    { $match: orderCountMatch },
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        address: 1,
        fop: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        orderCount: 1,
      },
    },
    {
      $facet: {
        customers: [
          { $sort: sort },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]).collation({ locale: 'pl', strength: 1 })
  const customers = result.customers
  const totalCustomers = result.total[0]?.count || 0
  res.json({
    customers,
    totalCustomers,
    page,
    limit,
    totalPages: Math.ceil(totalCustomers / limit),
  })
})

export const getAdminCustomerProfile = expressAsyncHandler(async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(404).json({ message: 'Customer not found' })
  }
  const customer = await User.findById(req.params.id).select(
    'name email phone address fop status createdAt updatedAt',
  )
  if (!customer || customer.status === 'adm') {
    return res.status(404).json({ message: 'Customer not found' })
  }
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
    100,
  )
  const filter = { userId: String(customer._id) }
  const [result] = await Order.aggregate([
    { $match: filter },
    { $addFields: { orderType: 'regular' } },
    {
      $unionWith: {
        coll: oneClickOrdersCollection,
        pipeline: [
          { $match: filter },
          { $addFields: { orderType: 'one-click' } },
        ],
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $facet: {
        orders: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ])
  const orders = result?.orders || []
  const totalOrders = result?.total[0]?.count || 0
  res.json({
    customer,
    orders,
    totalOrders,
    page,
    limit,
    totalPages: Math.ceil(totalOrders / limit),
  })
})

export const signIn = expressAsyncHandler(async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email })
    if (user) {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        res.send({
          _id: user._id,
          name: user.name,
          email: user.email,
          status: user.status,
          phone: user.phone,
          address: user.address,
          fop: user.fop,
          token: generateToken(user),
        })
        return
      }
    }
    res.status(401).send({ message: 'Invalid email or password' })
  } catch (err) {
    res.status(400).send({ message: err.message })
  }
})

export const signUp = expressAsyncHandler(async (req, res) => {
  try {
    const person = await User.findOne({ email: req.body.email })
    if (person) {
      throw new Error('User already exist')
    }

    const salt = bcrypt.genSaltSync(10)
    const newUser = new User({
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, salt),
      name: req.body.name,
      status: req.body.status,
      phone: req.body.phone,
      address: req.body.address,
      fop: req.body.fop,
    })

    const user = await newUser.save()

    // Письмо — не блокируем ответ клиенту
    ;(async () => {
      try {
        const { subject, html, text } = welcomeEmailPL({ name: user.name })
        await sendMail({
          to: user.email,
          subject,
          html,
          text,
        })
      } catch (mailErr) {
        console.error(
          'Mail send error:',
          mailErr?.response || mailErr?.message || mailErr,
        )
      }
    })()

    res.send({
      _id: user._id,
      name: user.name,
      email: user.email,
      status: user.status,
      phone: user.phone,
      address: user.address,
      fop: user.fop,
      token: generateToken(user),
    })
  } catch (err) {
    res.status(401).send({ message: err.message })
  }
})

export const editUserInfo = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params
    const user = await User.findOne({ _id: id })
    if (user) {
      user.name = req.body.name || user.name
      user.phone = req.body.phone || user.phone
      user.address = req.body.address || user.address
      user.fop = req.body.fop || user.fop

      const updatedUser = await user.save()
      res.send({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        status: updatedUser.status,
        phone: updatedUser.phone,
        address: updatedUser.address,
        fop: updatedUser.fop,
        token: generateToken(updatedUser),
      })
      return
    } else {
      res.status(404).send({ message: 'user not found' })
      return
    }
  } catch (err) {
    res.status(400).send(err)
  }
})
