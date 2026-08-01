import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Location from '../models/Location.js'

dotenv.config()

const ukrainianLocationTitles = [
  'Киев',
  'Одесса',
  'Николаев',
  'Львов',
  'Харьков',
]

const migrate = async () => {
  if (!process.env.MONGODB_URL) {
    throw new Error('MONGODB_URL is required')
  }

  await mongoose.connect(process.env.MONGODB_URL)
  const result = await Location.deleteMany({
    title: { $in: ukrainianLocationTitles },
  })

  console.log(`Removed ${result.deletedCount} Ukrainian location groups from the Polish database.`)
}

try {
  await migrate()
} catch (error) {
  console.error('Polish location cleanup failed:', error)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
