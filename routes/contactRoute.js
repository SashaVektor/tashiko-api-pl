// routes/contactRoute.js
import express from 'express'
import expressAsyncHandler from 'express-async-handler'
import {
  logEmailResults,
  queueEmailsAndAttempt,
} from '../services/emailOutbox.js'
import { contactAdminEmail } from '../utils/templates/adminEmailTemplates.js'
import { getAdminNotificationEmail } from '../utils/getAdminNotificationEmail.js'

const router = express.Router()

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

    // шлём письмо админу через outbox (retry on SMTP failure)
    const adminTo = await getAdminNotificationEmail()
    if (adminTo) {
      const mail = contactAdminEmail({ phone, message, page })

      queueEmailsAndAttempt([
        {
          kind: 'contact-admin',
          relatedId: cleaned,
          to: adminTo,
          subject: mail.subject,
          html: mail.html,
          text: mail.textPlain,
        },
      ])
        .then((results) => logEmailResults(results, 'contact form'))
        .catch((e) => {
          console.error(
            '[CONTACT] Mail queue error:',
            e?.response || e?.message || e,
          )
        })
    } else {
      console.warn('[Mailer] ADMIN_EMAIL is not configured')
    }
  }),
)

export default router
