import expressAsyncHandler from 'express-async-handler'
import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { generateToken } from '../utils.js'
import {
  logEmailResults,
  queueEmailsAndAttempt,
} from '../services/emailOutbox.js'
import { welcomeEmailPL } from '../utils/templates/customerEmailTemplates.js'
import Order from '../models/Order.js'
import OrderOneClick from '../models/OrderOneClick.js'

const escapeRegExp = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const regularOrdersCollection = Order.collection.name
const oneClickOrdersCollection = OrderOneClick.collection.name

const normalizeCustomerInput = (body = {}) => ({
  name: String(body.name || '').trim(),
  email: String(body.email || '').trim().toLowerCase(),
  phone: String(body.phone || '').trim(),
  address: String(body.address || '').trim(),
  fop: String(body.fop || '').trim(),
})

const validateCustomerInput = ({ name, email, phone, address }) => {
  if (!name || !email || !phone || !address) {
    return 'Name, email, phone and address are required'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Invalid email address'
  }
  const normalizedPhone = phone.replace(/[\s()-]/g, '')
  if (!/^(?:\+48|48)?\d{9}$/.test(normalizedPhone)) {
    return 'Invalid phone number'
  }
  return null
}

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
  const regularPage = Math.max(
    Number.parseInt(req.query.regularPage, 10) || 1,
    1,
  )
  const oneClickPage = Math.max(
    Number.parseInt(req.query.oneClickPage, 10) || 1,
    1,
  )
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
    100,
  )
  const filter = { userId: String(customer._id) }
  const [
    regularOrders,
    totalRegularOrders,
    oneClickOrders,
    totalOneClickOrders,
  ] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((regularPage - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
    OrderOneClick.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((oneClickPage - 1) * limit)
      .limit(limit),
    OrderOneClick.countDocuments(filter),
  ])

  res.json({
    customer,
    regularOrders,
    oneClickOrders,
    totalOrders: totalRegularOrders + totalOneClickOrders,
    totalRegularOrders,
    totalOneClickOrders,
    regularPage,
    oneClickPage,
    limit,
    regularTotalPages: Math.ceil(totalRegularOrders / limit),
    oneClickTotalPages: Math.ceil(totalOneClickOrders / limit),
  })
})

export const createAdminCustomer = expressAsyncHandler(async (req, res) => {
  const customerInput = normalizeCustomerInput(req.body)
  const validationError = validateCustomerInput(customerInput)
  if (validationError) {
    return res.status(400).json({ message: validationError })
  }

  const password = String(req.body.password || '')
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must contain at least 6 characters' })
  }

  const existingCustomer = await User.findOne({ email: customerInput.email })
  if (existingCustomer) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  const customer = await User.create({
    ...customerInput,
    password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
    status: 'member',
  })

  return res.status(201).json({
    customer: await User.findById(customer._id).select(
      'name email phone address fop status createdAt updatedAt',
    ),
  })
})

export const updateAdminCustomer = expressAsyncHandler(async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(404).json({ message: 'Customer not found' })
  }

  const customer = await User.findById(req.params.id)
  if (!customer || customer.status === 'adm') {
    return res.status(404).json({ message: 'Customer not found' })
  }

  const customerInput = normalizeCustomerInput(req.body)
  const validationError = validateCustomerInput(customerInput)
  if (validationError) {
    return res.status(400).json({ message: validationError })
  }

  const duplicate = await User.findOne({
    email: customerInput.email,
    _id: { $ne: customer._id },
  })
  if (duplicate) {
    return res.status(409).json({ message: 'A user with this email already exists' })
  }

  Object.assign(customer, customerInput)
  await customer.save()

  return res.json({
    customer: await User.findById(customer._id).select(
      'name email phone address fop status createdAt updatedAt',
    ),
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
      phone: req.body.phone,
      address: req.body.address,
      fop: req.body.fop,
    })

    const user = await newUser.save()

    // Письмо — не блокируем ответ клиенту; outbox retry if SMTP fails
    ;(async () => {
      try {
        const { subject, html, text } = welcomeEmailPL({ name: user.name })
        const results = await queueEmailsAndAttempt([
          {
            kind: 'welcome-customer',
            relatedId: String(user._id),
            to: user.email,
            subject,
            html,
            text,
          },
        ])
        logEmailResults(results, `welcome ${user._id}`)
      } catch (mailErr) {
        console.error(
          '[Mailer] welcome queue failed:',
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
