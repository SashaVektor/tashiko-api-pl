// /routes/paypalRoute.js
import express from 'express'
import axios from 'axios'
import Order from '../models/Order.js'

const router = express.Router()

function base() {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

async function paypalToken() {
  const url = `${base()}/v1/oauth2/token`
  const resp = await axios.post(
    url,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  )
  return resp.data.access_token
}

router.post('/orders', async (req, res) => {
  try {
    const order = await Order.findById(req.body.orderId)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.isPaid)
      return res.status(409).json({ error: 'Order is already paid' })
    if (
      !Number.isFinite(order.totalPrice) ||
      order.totalPrice <= 0 ||
      order.basketItems.some((item) => item.currency !== 'PLN')
    ) {
      return res.status(422).json({ error: 'Order has invalid pricing' })
    }
    const token = await paypalToken()
    const resp = await axios.post(
      `${base()}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              value: order.totalPrice.toFixed(2),
              currency_code: 'PLN',
            },
            description: `Order #${order._id}`,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    order.payment = { provider: 'paypal', invoiceId: resp.data.id }
    await order.save()
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

router.post('/orders/:id/capture', async (req, res) => {
  try {
    const order = await Order.findOne({
      'payment.provider': 'paypal',
      'payment.invoiceId': req.params.id,
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    const token = await paypalToken()
    const resp = await axios.post(
      `${base()}/v2/checkout/orders/${req.params.id}/capture`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (resp.data.status === 'COMPLETED') {
      order.isPaid = true
      await order.save()
    }
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

export default router
