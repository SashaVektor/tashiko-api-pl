import expressAsyncHandler from 'express-async-handler'
import ProductFeed from '../models/ProductFeed.js'
import CrossNumbers from '../models/CrossNumbers.js'
import {
  buildProductFilter,
  createSearchRegex,
  getCollation,
  getPagination,
  getProductSort,
  normalizeSearchQuery,
} from '../utils/productQuery.js'

export const getProductCatalog = async (req, res) => {
  try {
    const {
      q = '',
      category,
      sort = 'availability',
      language = 'pl',
      page: pageValue,
      limit: limitValue,
    } = req.query
    const { page, limit, skip } = getPagination(pageValue, limitValue)
    const normalizedQuery = normalizeSearchQuery(q)
    let filter = buildProductFilter({ query: normalizedQuery, groupName: category })

    if (normalizedQuery) {
      const crossMappings = await CrossNumbers.find({
        $or: [
          { article_a: createSearchRegex(normalizedQuery) },
          { article_b: createSearchRegex(normalizedQuery) },
        ],
      }).select('article_a')
      const crossCodes = [...new Set(crossMappings.map(({ article_a }) => article_a))]

      if (crossCodes.length) {
        const searchFilter = buildProductFilter({ query: normalizedQuery })
        const combinedSearch = {
          $or: [searchFilter, { item_code: { $in: crossCodes } }],
        }
        filter = category
          ? { $and: [{ group_name: category }, combinedSearch] }
          : combinedSearch
      }
    }

    const [products, totalProducts] = await Promise.all([
      ProductFeed.find(filter)
        .collation(getCollation(language))
        .sort(getProductSort(sort, language))
        .skip(skip)
        .limit(limit),
      ProductFeed.countDocuments(filter),
    ])

    res.status(200).json({
      products,
      totalProducts,
      page,
      limit,
      totalPages: Math.ceil(totalProducts / limit),
      query: normalizedQuery,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'INTERNAL SERVER ERROR' })
  }
}

export const searchProductsFeed = async (req, res) => {
  try {
    const {
      selectedBrand,
      selectedMark,
      category,
      selectedYear,
      sort = 'availability',
      language = 'pl',
    } = req.query

    if (!selectedBrand || !selectedMark) {
      return res
        .status(400)
        .json({ message: 'Selected brand and mark are required.' })
    }

    const brandRegex = new RegExp(selectedBrand, 'i')
    const markRegex = new RegExp(selectedMark, 'i')

    let filter = {
      $and: [
        { position_name: { $regex: brandRegex } },
        { position_name: { $regex: markRegex } },
      ],
    }

    if (category) {
      filter.group_name = category
    }

    if (selectedYear) {
      filter.$or = [
        { group_name: { $ne: 'Амортизаторы TASHIKO' } },
        {
          group_name: 'Амортизаторы TASHIKO',
          value_characteristics3: { $regex: new RegExp(selectedYear, 'i') },
        },
      ]
    }

    const products = await ProductFeed.find(filter)
      .collation(getCollation(language))
      .sort(getProductSort(sort, language))

    return res.status(200).json(products)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

export const getProductsFeed = async (req, res) => {
  try {
    const products = await ProductFeed.find().sort({ quantity: -1 })
    res.send(products)
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
}

export const getProductsBrands = async (req, res) => {
  try {
    const products = await ProductFeed.find().sort({ quantity: -1 })

    const brandsModels = {}

    products.forEach((product) => {
      let brandIndex = -1
      let modelIndex = -1

      for (let i = 1; i <= 14; i++) {
        if (product[`name_characteristics${i}`] === 'Марка') {
          brandIndex = i
        }
        if (product[`name_characteristics${i}`] === 'Модель') {
          modelIndex = i
        }
      }

      if (brandIndex !== -1 && modelIndex !== -1) {
        const brand = product[`value_characteristics${brandIndex}`]
        const model = product[`value_characteristics${modelIndex}`]

        if (brand && model) {
          if (!brandsModels[brand]) {
            brandsModels[brand] = []
          }

          if (!brandsModels[brand].includes(model)) {
            brandsModels[brand].push(model)
          }
        }
      }
    })

    Object.keys(brandsModels).forEach((brand) => {
      if (brandsModels[brand].length === 0) {
        delete brandsModels[brand]
      } else {
        brandsModels[brand].sort()
      }
    })

    const sortedBrandsModels = Object.keys(brandsModels)
      .sort()
      .reduce((acc, brand) => {
        acc[brand] = brandsModels[brand]
        return acc
      }, {})

    res.send(sortedBrandsModels)
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
}

export const getProductsFeedByGroup = async (req, res) => {
  try {
    const { groupName } = req.params

    if (!groupName) {
      return res
        .status(400)
        .json({ message: 'Категория (groupName) не передана' })
    }
    const products = await ProductFeed.find({ group_name: groupName }).sort({
      quantity: -1,
    })

    res.status(200).json(products)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Ошибка на сервере' })
  }
}

export const getProductsFeedByGroupWithLimit = async (req, res) => {
  try {
    const { groupName } = req.params
    const {
      page: pageValue,
      limit: limitValue,
      sort = 'availability',
      language = 'pl',
      q = '',
    } = req.query

    if (!groupName) {
      return res
        .status(400)
        .json({ message: 'Категория (groupName) не передана' })
    }

    const { page, limit, skip } = getPagination(pageValue, limitValue)
    const filter = buildProductFilter({ query: q, groupName })
    const products = await ProductFeed.find(filter)
      .collation(getCollation(language))
      .sort(getProductSort(sort, language))
      .skip(skip)
      .limit(limit)

    const totalProducts = await ProductFeed.countDocuments(filter)

    res.status(200).json({
      products,
      totalProducts,
      page,
      limit,
      totalPages: Math.ceil(totalProducts / limit),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Ошибка на сервере' })
  }
}

export const getProductFeed = async (req, res) => {
  const { productCode } = req.params
  try {
    const product = await ProductFeed.findOne({ item_code: productCode })

    if (!product) {
      res.status(401).send({ message: 'Такого товару не існує!' })
    } else {
      res.send(product)
    }
  } catch (err) {
    res.status(401).send({ message: 'Такого товару не знайдено!' })
  }
}

export const getProductsByNumber = async (req, res) => {
  const { number } = req.params

  try {
    const normalizedNumber = normalizeSearchQuery(number)
    if (!normalizedNumber) {
      return res.status(400).send({ message: 'Wprowadź numer produktu.' })
    }
    const numberRegex = createSearchRegex(normalizedNumber)

    // Поиск по методу 1: прямое совпадение по item_code
    const directProducts = await ProductFeed.find({
      item_code: numberRegex,
    })

    // Поиск по методу 2: через кросс-номера
    const mappings = await CrossNumbers.find({
      $or: [
        { article_b: numberRegex },
        { article_a: numberRegex },
      ],
    })

    let crossProducts = []
    if (mappings.length > 0) {
      // Получаем все article_a из найденных кросс-номеров
      const articleCodes = mappings.map((mapping) => mapping.article_a)

      // Ищем товары по этим article codes
      crossProducts = await ProductFeed.find({
        item_code: { $in: articleCodes },
      }).sort({ quantity: -1 })
    }

    // Объединяем результаты и удаляем дубликаты
    const allProducts = [...directProducts, ...crossProducts]
    const uniqueProducts = allProducts.filter(
      (product, index, self) =>
        index ===
        self.findIndex((p) => p._id.toString() === product._id.toString()),
    )

    if (uniqueProducts.length > 0) {
      res.send(uniqueProducts)
    } else {
      res.status(404).send({ message: 'Товарів не знайдено!' })
    }
  } catch (err) {
    console.error(err)
    res.status(500).send({ message: 'Помилка сервера' })
  }
}

// export const createProduct = expressAsyncHandler(async (req, res) => {
//   try {
//     const product = req.body;
//     const newProduct = new Product({
//       productCode: product.productCode,
//       itemNameUkr: product.itemNameUkr,
//       price: product.price,
//       currency: product.currency,
//       imageLink: product.imageLink,
//       availability: product.availability,
//       groupName: product.groupName,
//       manufacturer: product.manufacturer,
//       countryOfManufacturer: product.countryOfManufacturer,
//       attributeName: product.attributeName,
//       attributeName2: product.attributeName2,
//       attributeName3: product.attributeName3,
//       attributeName4: product.attributeName4,
//       attributeName5: product.attributeName5,
//       attributeName6: product.attributeName6,
//       attributeValue: product.attributeValue,
//       attributeValue2: product.attributeValue2,
//       attributeValue3: product.attributeValue3,
//       attributeValue4: product.attributeValue4,
//       attributeValue5: product.attributeValue5,
//       attributeValue6: product.attributeValue6,
//     });
//     const prod = await newProduct.save();
//     if (prod) {
//       res.status(200).send({ message: "Продукт создан успешно!" });
//     }
//   } catch (err) {
//     console.log(err);
//     res.status(500).send({ message: "INTERNAL SERVER ERROR" });
//   }
// });

export const editProduct = expressAsyncHandler(async (req, res) => {
  try {
    const product = await ProductFeed.findById(req.body.id)

    if (product) {
      product.price = req.body.price || product.price
      product.quantity = req.body.quantity || product.quantity

      const updatedProduct = await product.save()

      if (!updatedProduct) {
        res.status(403).send({ message: 'Что-то пошло не так!' })
        return
      }

      res.status(200).send({ message: 'Продукт успешно изменен!' })
    } else {
      return res.status(404).send({ message: 'Product Not Found' })
    }
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})

export const removeProductFeed = expressAsyncHandler(async (req, res) => {
  try {
    const product = await ProductFeed.findById(req.params.id)
    if (product) {
      await product.deleteOne()
      res.send({ message: 'Продукт успешно удален!' })
    } else {
      res.status(404).send({ message: 'Product not found' })
    }
  } catch (err) {
    console.log(err)
    res.status(500).send({ message: 'INTERNAL SERVER ERROR' })
  }
})
