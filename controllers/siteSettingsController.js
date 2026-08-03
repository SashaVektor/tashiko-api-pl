import expressAsyncHandler from 'express-async-handler'
import SiteSettings from '../models/SiteSettings.js'
import { getAdminNotificationEmail } from '../utils/getAdminNotificationEmail.js'
import { verifyMailConfiguration } from '../utils/mailer.js'
import { queueEmailAndAttempt } from '../services/emailOutbox.js'

const emptySettings = {
  key: 'site-settings',
  contacts: { emails: [], phones: [] },
  workingHours: { ua: '', ru: '', pl: '' },
  delivery: {
    title: { ua: '', ru: '', pl: '' },
    blocks: [],
  },
}

const toPublicSettings = (settings) => {
  if (!settings) return emptySettings
  const { notifications, ...publicSettings } = settings
  return publicSettings
}

const editableFields = ({ contacts, workingHours, delivery }) => ({
  contacts,
  workingHours,
  delivery,
})

export const getSiteSettings = expressAsyncHandler(async (_req, res) => {
  const settings = await SiteSettings.findOne({ key: 'site-settings' }).lean()

  res.send(toPublicSettings(settings))
})

export const getAdminSiteSettings = expressAsyncHandler(async (_req, res) => {
  const settings = await SiteSettings.findOne({ key: 'site-settings' }).lean()

  res.send(toPublicSettings(settings))
})

export const updateSiteSettings = expressAsyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOneAndUpdate(
    { key: 'site-settings' },
    { $set: editableFields(req.body) },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )

  res.status(200).send(settings)
})

export const sendAdminTestEmail = expressAsyncHandler(async (_req, res) => {
  const recipient = await getAdminNotificationEmail()
  if (!recipient) {
    return res.status(400).send({
      message: 'ADMIN_EMAIL nie jest skonfigurowany na serwerze',
    })
  }

  try {
    await verifyMailConfiguration()
    const subject = 'Testowe powiadomienie e-mail — Tashiko PL'
    await queueEmailAndAttempt({
      kind: 'test',
      relatedId: 'site-settings',
      to: recipient,
      subject,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>Testowe powiadomienie Tashiko PL</h2>
          <p>SMTP i adres e-mail administratora są skonfigurowane prawidłowo.</p>
        </div>
      `,
      text: 'Testowe powiadomienie Tashiko PL. SMTP i adres e-mail administratora są skonfigurowane prawidłowo.',
    })
    return res.send({ message: 'Wiadomość testowa została wysłana' })
  } catch (error) {
    return res.status(502).send({
      message: 'Nie udało się wysłać wiadomości testowej',
      error: error.message,
      queued: Boolean(error.notificationId),
    })
  }
})
