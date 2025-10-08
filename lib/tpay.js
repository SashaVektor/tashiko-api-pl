// /lib/tpay.js
import axios from 'axios'
import crypto from 'crypto'
import https from 'https'
import { URL } from 'url'

const TPAY_ENV = process.env.TPAY_ENV || 'production'
export const TPAY_BASE_URL = 'https://api.tpay.com'

let tokenCache = { accessToken: null, expiresAt: 0 }

export async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (tokenCache.accessToken && tokenCache.expiresAt - 60 > now) {
    return tokenCache.accessToken
  }
  const resp = await axios.post(
    `${TPAY_BASE_URL}/oauth/auth`,
    new URLSearchParams({
      client_id:
        process.env.TPAY_CLIENT_ID ||
        '01K2M6KGDWG9V6D8YZ6A7RZ1WR-01K6AJYXX82R2GMA85MMBG56DH',
      client_secret:
        process.env.TPAY_CLIENT_SECRET ||
        '68895a32c4e52e38eef9ee6732c4e22cd5b604b0b89a39e0fb79748f79bfa919',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
  tokenCache.accessToken = resp.data.access_token
  tokenCache.expiresAt =
    (resp.data.issued_at || now) + (resp.data.expires_in || 7200)
  return tokenCache.accessToken
}

// Обертки над Tpay API
export async function tpayGet(path) {
  const access = await getAccessToken()
  return axios.get(`${TPAY_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${access}` },
  })
}

export async function tpayPost(path, body) {
  const access = await getAccessToken()
  return axios.post(`${TPAY_BASE_URL}${path}`, body, {
    headers: {
      Authorization: `Bearer ${access}`,
      'Content-Type': 'application/json',
    },
  })
}

// Шифрование карт (если по необходимости делаешь на бэкенде; рекомендуем на фронте для снижения PCI DSS)
export function rsaEncryptCardPlaintext(plaintext, pemPublicKey) {
  // plaintext формат: "PAN|MM/YY|CVV|https://your-domain"
  const buffer = Buffer.from(plaintext, 'utf8')
  const encrypted = crypto.publicEncrypt(
    { key: pemPublicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    buffer,
  )
  return encrypted.toString('base64')
}

// Валидация JWS из webhook (упрощённо: проверка подписи; цепочку до CA смотри ниже)
export async function verifyTpayJwsSignature(req, rawBodyBuffer) {
  const jws = req.headers['x-jws-signature']
  if (!jws || typeof jws !== 'string')
    throw new Error('Missing X-JWS-Signature')

  const [encodedHeader, , encodedSignature] = jws.split('.')
  if (!encodedHeader || !encodedSignature) throw new Error('Malformed JWS')

  const headerJson = JSON.parse(
    Buffer.from(encodedHeader, 'base64url').toString('utf8'),
  )
  const x5u = headerJson.x5u
  if (!x5u || !x5u.startsWith('https://secure.tpay.com')) {
    throw new Error('Invalid x5u')
  }

  // Скачиваем сертификат из x5u и верифицируем подпись содержимого
  const certResp = await axios.get(x5u, { responseType: 'arraybuffer' })
  const publicCertPem = Buffer.from(certResp.data).toString('utf8')

  // База для подписи: "<header>.<payload>", где payload — base64url(rawBody)
  const payloadB64Url = Buffer.from(rawBodyBuffer).toString('base64url')
  const dataToVerify = `${encodedHeader}.${payloadB64Url}`
  const signature = Buffer.from(encodedSignature, 'base64url')

  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(dataToVerify)
  verifier.end()
  const ok = verifier.verify(publicCertPem, signature)

  if (!ok) throw new Error('Invalid JWS signature')

  // (Опционально) проверь цепочку до CA: https://secure.tpay.com/x509/tpay-jws-root.pem
  // Можно использовать стороннюю библиотеку X509 для строгой проверки цепочки, если нужно. :contentReference[oaicite:8]{index=8}

  return true
}

// Доп. проверка md5sum из form-urlencoded webhook (традиционная проверка)
export function verifyLegacyMd5(formObj) {
  const id = String(formObj.id ?? '')
  const trId = String(formObj.tr_id ?? '')
  const amt = String(formObj.tr_amount ?? '')
  const crc = String(formObj.tr_crc ?? '')
  const code = process.env.TPAY_NOTIFICATION_CODE || ''

  if (!formObj.md5sum) return false
  const expected = crypto
    .createHash('md5')
    .update(id + trId + amt + crc + code)
    .digest('hex')
  return expected === formObj.md5sum
}
