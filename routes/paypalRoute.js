// /routes/paypalRoute.js
import express from 'express'
import axios from 'axios'

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
    const { amount, currency = 'PLN', description } = req.body
    const token = await paypalToken()
    const resp = await axios.post(
      `${base()}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { value: String(amount), currency_code: currency },
            description,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

router.post('/orders/:id/capture', async (req, res) => {
  try {
    const token = await paypalToken()
    const resp = await axios.post(
      `${base()}/v2/checkout/orders/${req.params.id}/capture`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

export default router
