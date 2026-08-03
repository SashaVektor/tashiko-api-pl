import dotenv from 'dotenv'
import mongoose from 'mongoose'
import SiteSettings from '../models/SiteSettings.js'

dotenv.config()

const socialLinks = [
  { platform: 'instagram', url: 'https://www.instagram.com/tashiko_pl/', enabled: true, order: 0 },
  { platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=61574886003842', enabled: true, order: 1 },
]

const migrate = async () => {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL is required')
  await mongoose.connect(process.env.MONGODB_URL)
  await SiteSettings.updateOne(
    { key: 'site-settings' },
    { $set: { socialLinks }, $setOnInsert: { key: 'site-settings' } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )
  console.log('Polish social links seeded.')
}

try { await migrate() } catch (error) { console.error('Social-link migration failed:', error); process.exitCode = 1 } finally { await mongoose.disconnect() }
