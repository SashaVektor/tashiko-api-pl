import dotenv from 'dotenv'
import mongoose from 'mongoose'
import SiteSettings from '../models/SiteSettings.js'

dotenv.config()

const settings = {
  contacts: {
    phones: [
      {
        label: '',
        value: '+48452428487',
        displayValue: '+48 452 428 487',
        isPrimary: true,
        enabled: true,
        languages: ['pl'],
      },
    ],
    emails: [
      {
        label: '',
        value: 'tashiko.polska@gmail.com',
        displayValue: '',
        isPrimary: true,
        enabled: true,
        languages: ['pl'],
      },
    ],
  },
  workingHours: {
    ua: '',
    ru: '',
    pl: 'Pn-Pt 09:00-17:00\nSb 09:00-15:00',
  },
  delivery: {
    title: { ua: '', ru: '', pl: 'Dostawa' },
    blocks: [
      {
        title: { ua: '', ru: '', pl: '' },
        content: {
          ua: '',
          ru: '',
          pl: 'Zamówienia złożone do godziny 14:00 są wysyłane tego samego dnia.',
        },
        enabled: true,
        order: 0,
        languages: ['pl'],
      },
      {
        title: { ua: '', ru: '', pl: '' },
        content: {
          ua: '',
          ru: '',
          pl: 'Zamówienia złożone po godzinie 14:00 są wysyłane następnego dnia roboczego.',
        },
        enabled: true,
        order: 1,
        languages: ['pl'],
      },
      {
        title: { ua: '', ru: '', pl: '' },
        content: {
          ua: '',
          ru: '',
          pl: 'Wysyłka jest możliwa za pośrednictwem wszystkich dostępnych firm kurierskich.',
        },
        enabled: true,
        order: 2,
        languages: ['pl'],
      },
    ],
  },
}

const migrate = async () => {
  if (!process.env.MONGODB_URL) {
    throw new Error('MONGODB_URL is required')
  }

  await mongoose.connect(process.env.MONGODB_URL)

  const result = await SiteSettings.updateOne(
    { key: 'site-settings' },
    {
      $set: settings,
      $setOnInsert: { key: 'site-settings' },
    },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )

  console.log(
    `Polish site settings migration complete (matched: ${result.matchedCount}, modified: ${result.modifiedCount}, upserted: ${result.upsertedCount})`,
  )
}

try {
  await migrate()
} catch (error) {
  console.error('Polish site settings migration failed:', error)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
