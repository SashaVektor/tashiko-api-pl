import dotenv from 'dotenv'
import mongoose from 'mongoose'
import SiteSettings from '../models/SiteSettings.js'

dotenv.config()

const polishDelivery = {
  title: { ua: '', ru: '', pl: 'Dostawa, gwarancja i zwrot' },
  blocks: [
    {
      title: { ua: '', ru: '', pl: 'Dostawa' },
      content: {
        ua: '',
        ru: '',
        pl: 'Zamówienia złożone do godz. 14:00 wysyłamy tego samego dnia roboczego.\nZamówienia po godz. 14:00 wysyłamy następnego dnia roboczego.\nWysyłka realizowana przez InPost i DPD.\nKoszt i czas dostawy widoczne są w koszyku przed złożeniem zamówienia.\nPo nadaniu przesyłki otrzymasz numer śledzenia.',
      },
      enabled: true,
      order: 0,
      languages: ['pl'],
    },
    {
      title: { ua: '', ru: '', pl: 'Gwarancja' },
      content: {
        ua: '',
        ru: '',
        pl: 'Wszystkie produkty Tashiko są nowe i objęte 12-miesięczną gwarancją producenta.\nWarunkiem zachowania gwarancji jest montaż przez autoryzowany warsztat lub wykwalifikowanego mechanika.\nReklamacje przyjmujemy mailowo: tashiko.polska@gmail.com.\nCzas rozpatrzenia reklamacji: do 14 dni roboczych.',
      },
      enabled: true,
      order: 1,
      languages: ['pl'],
    },
    {
      title: { ua: '', ru: '', pl: 'Zwroty i wymiana' },
      content: {
        ua: '',
        ru: '',
        pl: 'Masz 14 dni na zwrot produktu zakupionego online – bez podawania przyczyny.\nTowar musi być kompletny, nieużywany i bez śladów montażu.\nProsimy o odesłanie w oryginalnym, nieuszkodzonym opakowaniu.\nKoszt wysyłki pokrywa Klient (z wyjątkiem reklamacji).\nAdres do zwrotów: TASHIKO Sp. z o.o. ul. Tęczowa 25, 53-601 Wrocław.',
      },
      enabled: true,
      order: 2,
      languages: ['pl'],
    },
    {
      title: { ua: '', ru: '', pl: 'Ważne' },
      content: {
        ua: '',
        ru: '',
        pl: 'W razie wątpliwości przed montażem lub zwrotem prosimy o kontakt:\n📧 tashiko.polska@gmail.com | ☎️ +48 452 428 487\nKażdy przypadek błędnego doboru części rozpatrujemy indywidualnie.',
      },
      enabled: true,
      order: 3,
      languages: ['pl'],
    },
  ],
}

const migrate = async () => {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL is required')

  await mongoose.connect(process.env.MONGODB_URL)
  const result = await SiteSettings.updateOne(
    { key: 'site-settings' },
    { $set: { delivery: polishDelivery } },
  )

  console.log(`Polish delivery page migration complete (matched: ${result.matchedCount}, modified: ${result.modifiedCount})`)
}

try {
  await migrate()
} catch (error) {
  console.error('Polish delivery page migration failed:', error)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
