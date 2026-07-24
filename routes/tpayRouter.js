// /routes/tpayRoute.js
import express from 'express'
import querystring from 'querystring'
import {
  tpayGet,
  tpayPost,
  verifyTpayJwsSignature,
  verifyLegacyMd5,
} from '../lib/tpay.js'
import Order from '../models/Order.js'

const router = express.Router()

// 4.1 Получить список доступных каналов/групп (чтобы отрисовать методы оплаты на фронте)
router.get('/channels', async (req, res) => {
  try {
    const resp = await tpayGet('/transactions/channels') // :contentReference[oaicite:9]{index=9}
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 4.2 Создать транзакцию (единый endpoint)
// body: { amount, description, payer:{email,name,ip,userAgent,phone}, method, mode, extra }
router.post('/transactions', async (req, res) => {
  try {
    const {
      payer = {},
      method = 'cards',
      mode = 'redirect',
      extra = {},
      orderId,
    } = req.body
    const order = await Order.findById(orderId)
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
    const callbackBaseUrl = process.env.PUBLIC_API_URL
    if (!callbackBaseUrl) {
      return res.status(503).json({ error: 'PUBLIC_API_URL is not configured' })
    }
    const description = `Order #${order._id}`
    const callbacks = {
      notification: {
        url: `${callbackBaseUrl}/api/tpay/webhook/transactions?orderId=${order._id}`,
      },
    }

    // Базовый каркас
    const base = {
      amount: Number(order.totalPrice.toFixed(2)),
      description,
      payer: {
        email: payer.email,
        name: payer.name,
        ...(payer.ip ? { ip: payer.ip } : {}),
        ...(payer.userAgent ? { userAgent: payer.userAgent } : {}),
        ...(payer.phone ? { phone: payer.phone } : {}),
      },
      hiddenDescription: String(order._id),
      ...(callbacks?.notification?.url ? { callbacks } : {}),
    }

    // Маппинг методов -> groupId/channelId и on-site поля
    let pay = {}
    if (method === 'blik') {
      // redirect или Level 0
      pay = { groupId: 150 } // :contentReference[oaicite:10]{index=10}
      if (mode === 'onsite' && extra.blikToken) {
        pay = { groupId: 150, blikPaymentData: { blikToken: extra.blikToken } } // :contentReference[oaicite:11]{index=11}
        if (extra.alias) {
          pay.blikPaymentData.aliases = {
            value: extra.alias.value,
            type: extra.alias.type || 'UID',
            label: extra.alias.label || '',
          } // OneClick/Recurring (опционально) :contentReference[oaicite:12]{index=12}
        }
      }
    } else if (method === 'cards') {
      pay = { groupId: 103 } // :contentReference[oaicite:13]{index=13}
    } else if (method === 'applepay') {
      pay = { channelId: 75 } // :contentReference[oaicite:14]{index=14}
    } else if (method === 'googlepay') {
      pay = { groupId: 166 } // :contentReference[oaicite:15]{index=15}
    } else if (method === 'visamobile') {
      pay = { groupId: 171 } // :contentReference[oaicite:16]{index=16}
    } else {
      return res.status(400).json({ error: 'Unsupported method for Tpay' })
    }

    const createBody = { ...base, ...pay }
    const created = await tpayPost('/transactions', createBody) // :contentReference[oaicite:17]{index=17}
    order.payment = {
      provider: 'tpay',
      invoiceId: created.data.transactionId,
    }
    await order.save()

    // Если on-site для карт — нужен второй шаг /pay (ожидание шифротекста карты)
    if (method === 'cards' && mode === 'onsite') {
      const txId = created.data.transactionId
      const cardCiphertext = extra.cardCiphertext || null
      if (!cardCiphertext) {
        // Возвращаем transactionId — фронт зашифрует и дернёт /pay отдельно
        return res.json({ ...created.data, needsPayStep: true })
      }
      const payResp = await tpayPost(`/transactions/${txId}/pay`, {
        groupId: 103,
        cardPaymentData: { card: cardCiphertext },
      }) // :contentReference[oaicite:18]{index=18}
      return res.json(payResp.data)
    }

    // Если on-site для Apple/Google Pay — второй шаг /pay с base64 токеном
    if (method === 'applepay' && mode === 'onsite') {
      const txId = created.data.transactionId
      if (!extra.applePayPaymentDataB64) {
        return res.json({ ...created.data, needsPayStep: true })
      }
      const payResp = await tpayPost(`/transactions/${txId}/pay`, {
        channelId: 75,
        applePayPaymentData: extra.applePayPaymentDataB64,
      }) // :contentReference[oaicite:19]{index=19}
      return res.json(payResp.data)
    }
    if (method === 'googlepay' && mode === 'onsite') {
      const txId = created.data.transactionId
      if (!extra.googlePayPaymentDataB64) {
        return res.json({ ...created.data, needsPayStep: true })
      }
      const payResp = await tpayPost(`/transactions/${txId}/pay`, {
        groupId: 166,
        googlePayPaymentData: extra.googlePayPaymentDataB64,
      }) // :contentReference[oaicite:20]{index=20}
      return res.json(payResp.data)
    }

    // Visa Mobile on-site: достаточно передать payer.phone в /transactions (см. спец. правила) :contentReference[oaicite:21]{index=21}

    // Redirect-флоу (или on-site уже завершён) — вернём как есть
    res.json(created.data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

// 4.3 Apple Pay init (проксируем валидатор для on-site)
router.post('/wallet/applepay/init', async (req, res) => {
  try {
    const { domainName, displayName, validationUrl } = req.body
    const resp = await tpayPost('/wallet/applepay/init', {
      domainName,
      displayName,
      validationUrl,
    })
    res.json(resp.data) // фронт передаст это в ApplePaySession.completeMerchantValidation(...)
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

// 4.4 Финализация /pay (универсальный для карт/Apple/Google), если делаешь из фронта отдельным шагом
router.post('/transactions/:id/pay', async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body // ожидаем уже корректный набор полей для метода
    const resp = await tpayPost(`/transactions/${id}/pay`, body)
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

// 4.5 Статус транзакции (fallback, основное — webhook)
router.get('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params
    const resp = await tpayGet(`/transactions/${id}`)
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message })
  }
})

// 4.6 Webhook ТРАНЗАКЦИЙ (нужно сырое тело для JWS)
router.post(
  '/webhook/transactions',
  async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(String(req.body || ''))
      const form = querystring.parse(rawBody.toString('utf8'))
      if (req.headers['x-jws-signature']) {
        await verifyTpayJwsSignature(req, rawBody)
      } else if (!verifyLegacyMd5(form)) {
        throw new Error('Invalid Tpay webhook signature')
      }
      if (form.tr_status !== 'TRUE') return res.status(200).send('TRUE')

      const orderId = String(form.tr_crc || req.query.orderId || '')
      if (!orderId) {
        throw new Error('Order ID is missing')
      }
      const order = await Order.findById(orderId)
      if (!order) throw new Error(`Order not found with ID: ${orderId}`)
      if (
        order.payment?.provider !== 'tpay' ||
        String(order.payment?.invoiceId) !== String(form.tr_id || '')
      ) {
        throw new Error('Tpay transaction does not match the order')
      }
      const paidAmount = Number(
        String(form.tr_amount || '').replace(',', '.'),
      )
      if (
        !Number.isFinite(paidAmount) ||
        Math.abs(paidAmount - order.totalPrice) > 0.009
      ) {
        throw new Error('Tpay amount does not match the order total')
      }
      order.isPaid = true
      await order.save()
      return res.status(200).send('TRUE')
    } catch (e) {
      console.error('Webhook error', e)
      return res.status(400).send('FALSE')
    }
  },
)

export default router
