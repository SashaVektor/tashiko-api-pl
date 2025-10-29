// routes/contactRoute.js
import express from 'express'
import expressAsyncHandler from 'express-async-handler'
import { sendMail } from '../utils/mailer.js'

const router = express.Router()

const emailTemplate = ({ phone, message, page }) => {
  const brand = 'Tashiko PL'
  const primary = '#BB170E'
  const bg = '#121212'
  const card = '#303637'
  const gray = '#ADB6B8'
  const white = '#FFFFFF'

  const safe = (s = '') =>
    String(s || '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const subject = `Nowa wiadomość kontaktowa — ${brand}`

  const html = `
  <div style="background:${bg};padding:24px;font-family:Arial,Helvetica,sans-serif;color:${white}">
    <div style="max-width:680px;margin:0 auto;background:${card};border-radius:10px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid ${primary}">
        <h1 style="margin:0;font-size:18px;color:${white}">Wiadomość kontaktowa</h1>
        <p style="margin:6px 0 0;color:${gray};font-size:13px">${brand} — powiadomienie administracyjne</p>
      </div>

      <div style="padding:20px 24px">
        <table style="width:100%;border-collapse:collapse;color:${white};font-size:14px">
          <tr>
            <td style="padding:8px 0;color:${gray};width:160px">Telefon</td>
            <td style="padding:8px 0"><strong>${safe(phone)}</strong></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${gray};vertical-align:top">Wiadomość</td>
            <td style="padding:8px 0;white-space:pre-wrap">${safe(message)}</td>
          </tr>
          ${
            page
              ? `<tr>
                  <td style="padding:8px 0;color:${gray};vertical-align:top">Strona</td>
                  <td style="padding:8px 0">
                    <a href="${safe(
                      page,
                    )}" style="color:${primary};text-decoration:none">${safe(
                  page,
                )}</a>
                  </td>
                </tr>`
              : ''
          }
        </table>
      </div>

      <div style="padding:16px 24px;border-top:1px solid ${primary};color:${gray};font-size:12px">
        To jest automatyczna wiadomość z formularza kontaktowego.
      </div>
    </div>
  </div>
  `

  const textPlain = `Nowa wiadomość kontaktowa — ${brand}
Telefon: ${phone}
Wiadomość: ${message}
Strona: ${page || '-'}`

  return { subject, html, textPlain }
}

router.post(
  '/',
  expressAsyncHandler(async (req, res) => {
    const { phone, message, page } = req.body || {}

    // простая валидация
    const cleaned = String(phone || '').replace(/\D+/g, '')
    if (cleaned.length < 7) {
      return res.status(400).json({ message: 'Nieprawidłowy numer telefonu' })
    }
    if (!message || String(message).trim().length < 5) {
      return res.status(400).json({ message: 'Wiadomość jest zbyt krótka' })
    }

    // отвечаем клиенту сразу, чтобы UI не ждал SMTP
    res.status(200).json({ message: 'Wiadomość została wysłana' })

    // шлём письмо админу асинхронно
    const adminTo = process.env.ADMIN_EMAIL || 'admin@tashiko.pl'
    const mail = emailTemplate({ phone, message, page })

    sendMail({
      to: adminTo,
      subject: mail.subject,
      html: mail.html,
      text: mail.textPlain,
    }).catch((e) => {
      console.error(
        '[CONTACT] Mail send error:',
        e?.response || e?.message || e,
      )
    })
  }),
)

export default router
