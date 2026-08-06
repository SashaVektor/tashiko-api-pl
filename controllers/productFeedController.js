import expressAsyncHandler from "express-async-handler";
import mongoose from "mongoose";
import ProductFeed from "../models/ProductFeed.js";
import CrossNumbers from "../models/CrossNumbers.js";
import {
  buildProductFilter,
  createSearchRegex,
  getCollation,
  getPagination,
  getProductSort,
  normalizeSearchQuery,
} from "../utils/productQuery.js";
import { enrichProductsWithPricing } from "../utils/orderPricing.js";
import {
  buildImportTemplateWorkbook,
  buildProductsWorkbook,
  importProductsFromFile,
} from "../utils/productImportExport.js";

export const getProductCatalog = async (req, res) => {
  try {
    const {
      q = "",
      category,
      sort = "availability",
      language = "pl",
      page: pageValue,
      limit: limitValue,
    } = req.query;
    const { page, limit, skip } = getPagination(pageValue, limitValue);
    const normalizedQuery = normalizeSearchQuery(q);
    const normalizedCategory =
      typeof category === "string" ? category.trim() : "";
    let filter = buildProductFilter({
      query: normalizedQuery,
      groupName: normalizedCategory,
    });

    if (normalizedQuery) {
      const crossMappings = await CrossNumbers.find({
        $or: [
          { article_a: createSearchRegex(normalizedQuery) },
          { article_b: createSearchRegex(normalizedQuery) },
        ],
      }).select("article_a");
      const crossCodes = [
        ...new Set(crossMappings.map(({ article_a }) => article_a)),
      ];

      if (crossCodes.length) {
        const searchFilter = buildProductFilter({ query: normalizedQuery });
        const combinedSearch = {
          $or: [searchFilter, { item_code: { $in: crossCodes } }],
        };
        filter = normalizedCategory
          ? { $and: [{ group_name: normalizedCategory }, combinedSearch] }
          : combinedSearch;
      }
    }

    const [products, totalProducts] = await Promise.all([
      ProductFeed.find(filter)
        .collation(getCollation(language))
        .sort(getProductSort(sort, language))
        .skip(skip)
        .limit(limit),
      ProductFeed.countDocuments(filter),
    ]);

    res.status(200).json({
      products: await enrichProductsWithPricing(products),
      totalProducts,
      page,
      limit,
      totalPages: Math.ceil(totalProducts / limit),
      query: normalizedQuery,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL SERVER ERROR" });
  }
};

export const searchProductsFeed = async (req, res) => {
  try {
    const {
      selectedBrand,
      selectedMark,
      category,
      selectedYear,
      sort = "availability",
      language = "pl",
    } = req.query;

    if (!selectedBrand || !selectedMark) {
      return res
        .status(400)
        .json({ message: "Selected brand and mark are required." });
    }

    const brandRegex = createSearchRegex(selectedBrand);
    const markRegex = createSearchRegex(selectedMark);

    let filter = {
      $and: [
        { position_name: { $regex: brandRegex } },
        { position_name: { $regex: markRegex } },
      ],
    };

    if (category && typeof category === "string") {
      filter.group_name = category;
    }

    if (selectedYear) {
      filter.$or = [
        { group_name: { $ne: "Амортизаторы TASHIKO" } },
        {
          group_name: "Амортизаторы TASHIKO",
          value_characteristics3: { $regex: createSearchRegex(selectedYear) },
        },
      ];
    }

    const products = await ProductFeed.find(filter)
      .collation(getCollation(language))
      .sort(getProductSort(sort, language));

    return res
      .status(200)
      .json(await enrichProductsWithPricing(products));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getProductsFeed = async (req, res) => {
  try {
    const products = await ProductFeed.find().sort({ quantity: -1 });
    res.send(await enrichProductsWithPricing(products));
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
};

export const getProductsBrands = async (req, res) => {
  try {
    const products = await ProductFeed.find().sort({ quantity: -1 });

    const brandsModels = {};

    products.forEach((product) => {
      let brandIndex = -1;
      let modelIndex = -1;

      for (let i = 1; i <= 14; i++) {
        if (product[`name_characteristics${i}`] === "Марка") {
          brandIndex = i;
        }
        if (product[`name_characteristics${i}`] === "Модель") {
          modelIndex = i;
        }
      }

      if (brandIndex !== -1 && modelIndex !== -1) {
        const brand = product[`value_characteristics${brandIndex}`];
        const model = product[`value_characteristics${modelIndex}`];

        if (brand && model) {
          if (!brandsModels[brand]) {
            brandsModels[brand] = [];
          }

          if (!brandsModels[brand].includes(model)) {
            brandsModels[brand].push(model);
          }
        }
      }
    });

    Object.keys(brandsModels).forEach((brand) => {
      if (brandsModels[brand].length === 0) {
        delete brandsModels[brand];
      } else {
        brandsModels[brand].sort();
      }
    });

    const sortedBrandsModels = Object.keys(brandsModels)
      .sort()
      .reduce((acc, brand) => {
        acc[brand] = brandsModels[brand];
        return acc;
      }, {});

    res.send(sortedBrandsModels);
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
};

export const getProductsFeedByGroup = async (req, res) => {
  try {
    const { groupName } = req.params;

    if (!groupName) {
      return res
        .status(400)
        .json({ message: "Категория (groupName) не передана" });
    }
    const products = await ProductFeed.find({ group_name: groupName }).sort({
      quantity: -1,
    });

    res.status(200).json(await enrichProductsWithPricing(products));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Ошибка на сервере" });
  }
};

export const getProductsFeedByGroupWithLimit = async (req, res) => {
  try {
    const { groupName } = req.params;
    const {
      page: pageValue,
      limit: limitValue,
      sort = "availability",
      language = "pl",
      q = "",
    } = req.query;

    if (!groupName) {
      return res
        .status(400)
        .json({ message: "Категория (groupName) не передана" });
    }

    const { page, limit, skip } = getPagination(pageValue, limitValue);
    const filter = buildProductFilter({ query: q, groupName });
    const products = await ProductFeed.find(filter)
      .collation(getCollation(language))
      .sort(getProductSort(sort, language))
      .skip(skip)
      .limit(limit);

    const totalProducts = await ProductFeed.countDocuments(filter);

    res.status(200).json({
      products: await enrichProductsWithPricing(products),
      totalProducts,
      page,
      limit,
      totalPages: Math.ceil(totalProducts / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Ошибка на сервере" });
  }
};

export const getProductFeed = async (req, res) => {
  const { productCode } = req.params;
  try {
    const product = await ProductFeed.findOne({ item_code: productCode });

    if (!product) {
      res.status(401).send({ message: "Такого товару не існує!" });
    } else {
      res.send((await enrichProductsWithPricing([product]))[0]);
    }
  } catch (err) {
    res.status(401).send({ message: "Такого товару не знайдено!" });
  }
};

export const getProductsByNumber = async (req, res) => {
  const { number } = req.params;

  try {
    const normalizedNumber = normalizeSearchQuery(number);
    if (!normalizedNumber) {
      return res.status(400).send({ message: "Wprowadź numer produktu." });
    }
    const numberRegex = createSearchRegex(normalizedNumber);

    // Поиск по методу 1: прямое совпадение по item_code
    const directProducts = await ProductFeed.find({
      item_code: numberRegex,
    });

    // Поиск по методу 2: через кросс-номера
    const mappings = await CrossNumbers.find({
      $or: [{ article_b: numberRegex }, { article_a: numberRegex }],
    });

    let crossProducts = [];
    if (mappings.length > 0) {
      // Получаем все article_a из найденных кросс-номеров
      const articleCodes = mappings.map((mapping) => mapping.article_a);

      // Ищем товары по этим article codes
      crossProducts = await ProductFeed.find({
        item_code: { $in: articleCodes },
      }).sort({ quantity: -1 });
    }

    // Объединяем результаты и удаляем дубликаты
    const allProducts = [...directProducts, ...crossProducts];
    const uniqueProducts = allProducts.filter(
      (product, index, self) =>
        index ===
        self.findIndex((p) => p._id.toString() === product._id.toString()),
    );

    if (uniqueProducts.length > 0) {
      res.send(await enrichProductsWithPricing(uniqueProducts));
    } else {
      res.status(404).send({ message: "Товарів не знайдено!" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Помилка сервера" });
  }
};

const ADMIN_PRODUCT_FIELDS = [
  "active",
  "position_name",
  "search_queries",
  "description",
  "product_type",
  "currency",
  "unit_of_measurement",
  "link_image",
  "group_name",
  "manufacturer",
  "country_of_production",
  "product_located",
  ...Array.from(
    { length: 14 },
    (_, index) => `name_characteristics${index + 1}`,
  ),
  ...Array.from(
    { length: 14 },
    (_, index) => `value_characteristics${index + 1}`,
  ),
];

const pickProductFields = (body, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [
        field,
        typeof body[field] === "string" ? body[field].trim() : body[field],
      ]),
  );

export const createProduct = expressAsyncHandler(async (req, res) => {
  const itemCode = String(req.body.item_code || "").trim();
  const source = req.body.source ?? "admin";
  if (!["ftp", "admin"].includes(source)) {
    return res.status(400).json({ message: "Invalid product source" });
  }
  if (!itemCode) return res.status(400).json({ message: "SKU is required" });
  if (await ProductFeed.exists({ item_code: itemCode })) {
    return res
      .status(409)
      .json({ message: "A product with this SKU already exists" });
  }
  const price = Number(req.body.price);
  const quantity = Number(req.body.quantity);
  const currency = "PLN";
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {
    return res
      .status(400)
      .json({ message: "Price and quantity must be non-negative numbers" });
  }
  const product = await ProductFeed.create({
    ...pickProductFields(req.body, ADMIN_PRODUCT_FIELDS),
    source,
    item_code: itemCode,
    price,
    quantity,
    currency,
    active: req.body.active !== false,
  });
  res.status(201).json({ message: "Продукт создан успешно!", product });
});
export const editProduct = expressAsyncHandler(async (req, res) => {
  try {
    const product = await ProductFeed.findById(req.body.id);

    if (product) {
      const source = req.body.source ?? product.source ?? "ftp";
      if (!["ftp", "admin"].includes(source)) {
        return res.status(400).json({ message: "Invalid product source" });
      }
      const editableFields =
        source === "admin"
          ? ["item_code", "price", "quantity", ...ADMIN_PRODUCT_FIELDS]
          : ADMIN_PRODUCT_FIELDS;
      const updates = pickProductFields(req.body, editableFields);
      updates.source = source;
      updates.currency = "PLN";

      if (source === "admin") {
        const itemCode = String(
          updates.item_code || product.item_code || "",
        ).trim();
        const price = Number(updates.price ?? product.price);
        const quantity = Number(updates.quantity ?? product.quantity);
        if (!itemCode)
          return res.status(400).json({ message: "SKU is required" });
        if (
          !Number.isFinite(price) ||
          price < 0 ||
          !Number.isFinite(quantity) ||
          quantity < 0
        ) {
          return res.status(400).json({
            message: "Price and quantity must be non-negative numbers",
          });
        }
        const duplicate = await ProductFeed.exists({
          item_code: itemCode,
          _id: { $ne: product._id },
        });
        if (duplicate)
          return res
            .status(409)
            .json({ message: "A product with this SKU already exists" });
        updates.item_code = itemCode;
        updates.price = price;
        updates.quantity = quantity;
      }
      Object.assign(product, updates);

      const updatedProduct = await product.save();

      if (!updatedProduct) {
        res.status(403).send({ message: "Что-то пошло не так!" });
        return;
      }

      res.status(200).send({ message: "Продукт успешно изменен!" });
    } else {
      return res.status(404).send({ message: "Product Not Found" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const importProducts = expressAsyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const originalName = req.file.originalname || "";
  const extension = originalName.split(".").pop()?.toLowerCase();
  if (!["xlsx", "csv"].includes(extension)) {
    return res
      .status(400)
      .json({ message: "Only .xlsx and .csv files are supported" });
  }
  const result = await importProductsFromFile(req.file.buffer, originalName);
  if (!result.success) {
    return res.status(400).json({ message: result.message });
  }
  res.status(200).json(result);
});

export const exportProducts = expressAsyncHandler(async (req, res) => {
  const idsParam = String(req.query.ids || "").trim();
  let filter = {};
  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    filter = { _id: { $in: ids } };
  }
  const products = await ProductFeed.find(filter).sort({ item_code: 1 }).lean();
  const workbook = buildProductsWorkbook(products);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="products-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
  );
  await workbook.xlsx.write(res);
  res.end();
});

export const downloadImportTemplate = expressAsyncHandler(async (req, res) => {
  const workbook = buildImportTemplateWorkbook();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="products-import-template.xlsx"',
  );
  await workbook.xlsx.write(res);
  res.end();
});

export const removeProductFeed = expressAsyncHandler(async (req, res) => {
  try {
    const product = await ProductFeed.findById(req.params.id);
    if (product) {
      await product.deleteOne();
      res.send({ message: "Продукт успешно удален!" });
    } else {
      res.status(404).send({ message: "Product not found" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});
