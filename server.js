import express from 'express'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import cors from 'cors'
import cron from 'node-cron'
import ftp from 'basic-ftp'
import csv from 'csv-parser'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

import userRouter from './routes/userRoute.js'
import categoryRoute from './routes/categoryRoute.js'
import uploadRouter from './routes/uploadRoute.js'
import vinRoute from './routes/vinRequestRoute.js'
import orderOneClickRouter from './routes/orderOneClickRoute.js'
import orderRouter from './routes/orderRoute.js'
import locationRoute from './routes/locationRoute.js'
import userGarageRoute from './routes/userGarageRoute.js'
import monobankRoute from './routes/monobankRoute.js'
import productFeedRoute from './routes/productFeedRoute.js'
import statisticsRouter from './routes/statisticsRoute.js'
import dollarRateRoute from './routes/dollarRateRoute.js'
import contactRoute from './routes/contactRoute.js'
import ProductFeed from './models/ProductFeed.js'

import tpayRouter from './routes/tpayRouter.js'
import paypalRouter from './routes/paypalRoute.js'

dotenv.config()
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log('Connected to db'))
  .catch((err) => console.log(err.message))

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/users', userRouter)
app.use('/api/categories', categoryRoute)
app.use('/api/vin', vinRoute)
app.use('/api/upload', uploadRouter)
app.use('/api/products-feed', productFeedRoute)
app.use('/api/orders', orderOneClickRouter)
app.use('/api/order', orderRouter)
app.use('/api/statistics', statisticsRouter)

app.use('/api/locations', locationRoute)
app.use('/api/garage', userGarageRoute)
app.use('/api/monobank', monobankRoute)
app.use('/api/dollar-rate', dollarRateRoute)
app.use('/api/contact', contactRoute)

// ----------- OPTIMIZED CSV SYNC FUNCTION (FTP) --------------------

async function downloadCSV() {
  const client = new ftp.Client()
  try {
    await client.access({
      host: process.env.FTP_HOST,
      port: Number(process.env.FTP_PORT),
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: false,
    })

    const outputPath = path.join('./', 'Products_PL.csv')
    await client.downloadTo(outputPath, '/Products_PL.csv')
    return outputPath
  } catch (err) {
    console.error('Ошибка при загрузке с FTP:', err)
    throw err
  } finally {
    client.close()
  }
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = []
    let lineCount = 0
    const startTime = Date.now()

    const stream = fs.createReadStream(filePath, {
      encoding: 'utf8',
      highWaterMark: 64 * 1024,
    })

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    })

    rl.on('line', (line) => {
      lineCount++
      if (lineCount % 10000 === 0) {
        console.log(`Обработано строк: ${lineCount}`)
      }

      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('item_code')) {
        const parts = trimmed.split(';')

        const item_code = parts[0]?.trim() || '0'
        const position_name = parts[1]?.trim() || '0'
        let quantity = parseInt(parts[2]) || 0
        let price = parseFloat(parts[3]?.replace(',', '.')) || 0

        if (item_code && item_code !== '0') {
          results.push({ item_code, position_name, quantity, price })
        }
      }
    })

    rl.on('close', () => {
      console.log(
        `CSV parsed in date ${Date.now() - startTime}ms, lines: ${lineCount}`,
      )
      resolve(results)
    })

    rl.on('error', reject)
  })
}

async function updateProducts(parsedData) {
  const startTime = Date.now()
  let updatedCount = 0
  const batchSize = 1000
  const bulkOps = []

  // Подготовка bulk операций
  for (const item of parsedData) {
    if (!item.item_code || isNaN(item.quantity) || isNaN(item.price)) continue

    bulkOps.push({
      updateOne: {
        filter: { item_code: item.item_code },
        update: {
          $set: {
            quantity: item.quantity,
            price: item.price,
            updatedAt: new Date(),
          },
        },
        upsert: false,
      },
    })

    if (bulkOps.length >= batchSize) {
      try {
        const result = await ProductFeed.bulkWrite(bulkOps)
        updatedCount += result.modifiedCount
        bulkOps.length = 0
      } catch (error) {
        console.error('Ошибка bulk операции:', error)
      }
    }
  }

  if (bulkOps.length > 0) {
    try {
      const result = await ProductFeed.bulkWrite(bulkOps)
      updatedCount += result.modifiedCount
    } catch (error) {
      console.error('Ошибка финальной bulk операции:', error)
    }
  }

  console.log(`Bulk update completed in ${Date.now() - startTime}ms`)
  console.log(`Синхронизация завершена. Обновлено товаров: ${updatedCount}`)

  return updatedCount
}

async function syncProductsFromFTP() {
  try {
    console.time('FTP Sync Total Time')

    console.time('FTP Download')
    const filePath = await downloadCSV()
    console.timeEnd('FTP Download')

    if (!filePath) {
      throw new Error('Не удалось загрузить CSV файл')
    }

    console.time('CSV Parsing')
    const parsedData = await parseCSV(filePath)
    console.timeEnd('CSV Parsing')

    console.time('DB Update')
    const updatedCount = await updateProducts(parsedData)
    console.timeEnd('DB Update')

    try {
      fs.unlinkSync(filePath)
      console.log('Временный файл удален')
    } catch (cleanupError) {
      console.warn('Не удалось удалить временный файл:', cleanupError)
    }

    console.timeEnd('FTP Sync Total Time')

    return {
      success: true,
      updatedCount,
      totalProcessed: parsedData.length,
    }
  } catch (error) {
    console.error('Ошибка синхронизации CSV:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}
app.get('/api/sync-products', async (req, res) => {
  try {
    console.log('Получен запрос на синхронизацию продуктов')
    const result = await syncProductsFromFTP()

    if (result.success) {
      res.status(200).json({
        message: 'Синхронизация завершена успешно',
        updatedCount: result.updatedCount,
        totalProcessed: result.totalProcessed,
      })
    } else {
      res.status(500).json({
        message: 'Ошибка при синхронизации продуктов',
        error: result.error,
      })
    }
  } catch (err) {
    console.error('Ошибка при синхронизации:', err)
    res.status(500).json({ message: 'Ошибка при синхронизации продуктов' })
  }
})

app.use('/api/tpay', tpayRouter)
app.use('/api/paypal', paypalRouter)

// async function syncPolishProducts() {
//   try {
//     console.log('Начало синхронизации с польским CSV файлом...')

//     // Чтение и парсинг польского CSV файла
//     const polishProducts = await parsePolishCSV('pl-tashiko.csv')

//     // Получаем все item_code из польского файла
//     const polishItemCodes = polishProducts.map((product) => product.item_code)

//     // Удаляем продукты, которых нет в польском файле
//     const deleteResult = await ProductFeed.deleteMany({
//       item_code: { $nin: polishItemCodes },
//     })
//     console.log(`Удалено продуктов: ${deleteResult.deletedCount}`)

//     // Обновляем или создаем продукты из польского файла
//     let updatedCount = 0
//     let createdCount = 0

//     for (const polishProduct of polishProducts) {
//       // Обрабатываем изображения (разделяем по | и объединяем через запятую)
//       const processedImages = polishProduct.link_image
//         ? polishProduct.link_image
//             .split('|')
//             .map((img) => img.trim())
//             .join(', ')
//         : ''

//       const updateData = {
//         item_code: polishProduct.item_code,
//         quantity: parseInt(polishProduct.quantity) || 0,
//         price:
//           parseFloat(polishProduct.price.toString().replace(',', '.')) || 0,
//         position_name: polishProduct.position_name || '',
//         link_image: processedImages,
//         // Остальные поля можно установить в default значения или оставить пустыми
//         currency: 'PLN',
//         unit_of_measurement: 'szt.',
//         country_of_production: 'Poland',
//       }

//       const result = await ProductFeed.findOneAndUpdate(
//         { item_code: polishProduct.item_code },
//         { $set: updateData },
//         { upsert: true, new: true },
//       )

//       if (result.$isNew) {
//         createdCount++
//       } else {
//         updatedCount++
//       }
//     }

//     console.log(`Синхронизация завершена!`)
//     console.log(`Создано новых продуктов: ${createdCount}`)
//     console.log(`Обновлено продуктов: ${updatedCount}`)
//     console.log(`Удалено продуктов: ${deleteResult.deletedCount}`)
//   } catch (error) {
//     console.error('Ошибка при синхронизации с польским CSV:', error)
//   }
// }

// // Функция для парсинга польского CSV
// async function parsePolishCSV(filePath) {
//   return new Promise((resolve, reject) => {
//     const results = []

//     fs.createReadStream(filePath)
//       .pipe(
//         csv({
//           separator: ',', // Польский CSV использует запятые
//           headers: [
//             'item_code',
//             'quantity',
//             'price',
//             'position_name',
//             'link_image',
//           ],
//           skipLines: 0, // Если есть заголовок
//         }),
//       )
//       .on('data', (data) => {
//         results.push({
//           item_code: data.item_code?.trim(),
//           quantity: data.quantity?.trim(),
//           price: data.price?.trim(),
//           position_name: data.position_name?.trim(),
//           link_image: data.link_image?.trim(),
//         })
//       })
//       .on('end', () => resolve(results))
//       .on('error', reject)
//   })
// }

// Функция для синхронизации польских товаров

// async function syncPolishProducts() {
//   try {
//     console.log('Начало синхронизации польских товаров...')

//     const csvFilePath = path.join(process.cwd(), 'prod.csv')

//     if (!fs.existsSync(csvFilePath)) {
//       console.log('Файл prod.csv не найден')
//       return
//     }

//     const products = []

//     // Чтение CSV файла
//     await new Promise((resolve, reject) => {
//       fs.createReadStream(csvFilePath)
//         .pipe(
//           csv({
//             separator: ',',
//             mapHeaders: ({ header }) => header.trim(),
//           }),
//         )
//         .on('data', (row) => {
//           products.push(row)
//         })
//         .on('end', () => {
//           console.log(`Прочитано ${products.length} товаров из CSV`)
//           resolve()
//         })
//         .on('error', (error) => {
//           console.error('Ошибка чтения CSV:', error)
//           reject(error)
//         })
//     })

//     let updatedCount = 0
//     let notFoundCount = 0

//     // Обработка каждого товара из CSV
//     for (const productData of products) {
//       const itemCode = productData.item_code

//       if (!itemCode) {
//         console.log('Пропуск товара без item_code')
//         continue
//       }

//       // Поиск товара в базе данных по item_code
//       const existingProduct = await ProductFeed.findOne({ item_code: itemCode })

//       if (existingProduct) {
//         // Подготовка объекта для обновления характеристик
//         const updateData = {}

//         // Очистка существующих характеристик
//         for (let i = 1; i <= 14; i++) {
//           updateData[`name_characteristics${i}`] = ''
//           updateData[`value_characteristics${i}`] = ''
//         }

//         // Заполнение характеристик из CSV
//         let charIndex = 1
//         for (const [key, value] of Object.entries(productData)) {
//           if (key !== 'item_code' && value && value !== '') {
//             if (charIndex <= 14) {
//               updateData[`name_characteristics${charIndex}`] = key
//               updateData[`value_characteristics${charIndex}`] = value
//               charIndex++
//             }
//           }
//         }

//         // Обновление товара в базе данных
//         await ProductFeed.updateOne(
//           { item_code: itemCode },
//           { $set: updateData },
//         )

//         updatedCount++
//         console.log(`Обновлен товар с item_code: ${itemCode}`)
//       } else {
//         notFoundCount++
//         console.log(`Товар с item_code: ${itemCode} не найден в базе данных`)
//       }
//     }

//     console.log(
//       `Синхронизация завершена. Обновлено: ${updatedCount}, Не найдено: ${notFoundCount}`,
//     )
//   } catch (error) {
//     console.error('Ошибка при синхронизации польских товаров:', error)
//   }
// }

// Функция для очистки пустых характеристик
// async function cleanEmptyCharacteristics() {
//   try {
//     console.log('Начало очистки пустых характеристик...')

//     // Находим все товары
//     const products = await ProductFeed.find({})
//     console.log(`Найдено ${products.length} товаров для проверки`)

//     let updatedCount = 0

//     for (const product of products) {
//       let needsUpdate = false
//       const updateData = {}

//       // Проверяем характеристики с 1 по 14
//       for (let i = 1; i <= 14; i++) {
//         const nameField = `name_characteristics${i}`
//         const valueField = `value_characteristics${i}`

//         const currentName = product[nameField]
//         const currentValue = product[valueField]

//         // Проверяем, являются ли значения пустыми строками
//         if (currentName === '' || currentValue === '') {
//           updateData[nameField] = null
//           updateData[valueField] = null
//           needsUpdate = true
//         }
//       }

//       // Если есть пустые строки, обновляем товар
//       if (needsUpdate) {
//         await ProductFeed.updateOne({ _id: product._id }, { $set: updateData })
//         updatedCount++
//         console.log(
//           `Очищены пустые характеристики для товара: ${product.item_code}`,
//         )
//       }
//     }

//     console.log(`Очистка завершена. Обновлено товаров: ${updatedCount}`)
//   } catch (error) {
//     console.error('Ошибка при очистке пустых характеристик:', error)
//   }
// }

// // Функция для сжатия характеристик (удаление null и сдвиг заполненных вверх)
// async function compressCharacteristics() {
//   try {
//     console.log('Начало сжатия характеристик...')

//     const products = await ProductFeed.find({})
//     console.log(`Найдено ${products.length} товаров для сжатия`)

//     let updatedCount = 0

//     for (const product of products) {
//       // Собираем все непустые характеристики
//       const nonEmptyCharacteristics = []

//       for (let i = 1; i <= 14; i++) {
//         const name = product[`name_characteristics${i}`]
//         const value = product[`value_characteristics${i}`]

//         // Проверяем, что оба поля не пустые и не null
//         if (name && value && name !== '' && value !== '') {
//           nonEmptyCharacteristics.push({ name, value })
//         }
//       }

//       // Если количество непустых характеристик меньше 14, нужно обновить
//       if (nonEmptyCharacteristics.length < 14) {
//         const updateData = {}

//         // Заполняем первые позиции непустыми характеристиками
//         nonEmptyCharacteristics.forEach((char, index) => {
//           updateData[`name_characteristics${index + 1}`] = char.name
//           updateData[`value_characteristics${index + 1}`] = char.value
//         })

//         // Остальные позиции заполняем null
//         for (let i = nonEmptyCharacteristics.length + 1; i <= 14; i++) {
//           updateData[`name_characteristics${i}`] = null
//           updateData[`value_characteristics${i}`] = null
//         }

//         await ProductFeed.updateOne({ _id: product._id }, { $set: updateData })
//         updatedCount++
//         console.log(`Сжаты характеристики для товара: ${product.item_code}`)
//       }
//     }

//     console.log(`Сжатие завершено. Обновлено товаров: ${updatedCount}`)
//   } catch (error) {
//     console.error('Ошибка при сжатии характеристик:', error)
//   }
// }

// // Комбинированная функция для полной очистки
// async function fullCleanCharacteristics() {
//   try {
//     console.log('=== Запуск полной очистки характеристик ===')

//     // Сначала удаляем пустые строки
//     await cleanEmptyCharacteristics()

//     // Затем сжимаем характеристики
//     await compressCharacteristics()

//     console.log('=== Полная очистка характеристик завершена ===')
//   } catch (error) {
//     console.error('Ошибка при полной очистке характеристик:', error)
//   }
// }

// async function removeNullCharacteristics() {
//   try {
//     console.log('Начало удаления null характеристик из базы данных...')

//     const products = await ProductFeed.find({})
//     console.log(`Найдено ${products.length} товаров для обработки`)

//     let updatedCount = 0

//     for (const product of products) {
//       const updateData = {}
//       let needsUpdate = false

//       // Проверяем характеристики с 1 по 14
//       for (let i = 1; i <= 14; i++) {
//         const nameField = `name_characteristics${i}`
//         const valueField = `value_characteristics${i}`

//         const currentName = product[nameField]
//         const currentValue = product[valueField]

//         // Если значение null, добавляем поле в $unset
//         if (currentName === null || currentValue === null) {
//           updateData[nameField] = ''
//           updateData[valueField] = ''
//           needsUpdate = true
//         }
//       }

//       // Если есть поля для удаления, обновляем документ
//       if (needsUpdate) {
//         await ProductFeed.updateOne(
//           { _id: product._id },
//           { $unset: updateData },
//         )
//         updatedCount++
//         console.log(
//           `Удалены null характеристики для товара: ${product.item_code}`,
//         )
//       }
//     }

//     console.log(
//       `Удаление null характеристик завершено. Обновлено товаров: ${updatedCount}`,
//     )
//   } catch (error) {
//     console.error('Ошибка при удалении null характеристик:', error)
//   }
// }

// cron.schedule('*/60 * * * *', async () => {
//   console.log('Запуск синхронизации продуктов каждые 10 минут...')
//   await syncProductsFromFTP()
// })

const port = process.env.PORT || 4200
app.listen(port, async () => {
  console.log(`Server ok on ${port}`)
  // await removeNullCharacteristics()
})
