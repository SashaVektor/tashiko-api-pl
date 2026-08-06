import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import ProductFeed from "../models/ProductFeed.js";

const FORCE_CURRENCY = "PLN";
const ALLOWED_CURRENCIES = ["PLN"];
const DEFAULT_CURRENCY = "PLN";
const MAX_IMPORT_ROWS = 5000;
const MAX_RECORDED_ERRORS = 200;
const MAX_RECORDED_SKIPPED = 200;

const CHARACTERISTIC_KEYS = Array.from({ length: 14 }, (_, index) => index + 1).flatMap(
  (number) => [`name_characteristics${number}`, `value_characteristics${number}`],
);

export const COLUMN_ORDER = [
  "item_code",
  "position_name",
  "product_type",
  "price",
  "currency",
  "quantity",
  "unit_of_measurement",
  "group_name",
  "manufacturer",
  "country_of_production",
  "product_located",
  "search_queries",
  "description",
  "link_image",
  "related_products",
  ...CHARACTERISTIC_KEYS,
];

const REQUIRED_KEYS = new Set(["item_code", "position_name", "price", "quantity"]);
const OPTIONAL_KEYS = COLUMN_ORDER.filter(
  (key) => !REQUIRED_KEYS.has(key) && key !== "currency",
);
const RELATED_PRODUCTS_KEY = "related_products";

const currencyDescription = FORCE_CURRENCY
  ? `Ignored on import — every product is always saved with currency "${FORCE_CURRENCY}".`
  : `USD or UAH. Defaults to ${DEFAULT_CURRENCY} if left blank.`;

const COLUMN_DESCRIPTIONS = {
  item_code:
    "Unique SKU / article number. Required. Matches an existing product to update it; otherwise a new product is created.",
  position_name: "Product name. Required.",
  product_type: "Product type / subtype label.",
  price: "Price as a plain number, e.g. 12.50. Required.",
  currency: currencyDescription,
  quantity: "Stock quantity as a non-negative whole number. Required.",
  unit_of_measurement: "Unit label, e.g. szt.",
  group_name: "Category name — must match an existing category exactly.",
  manufacturer: "Manufacturer name.",
  country_of_production: "Country of production.",
  product_located: "Warehouse / location label.",
  search_queries: "Extra search keywords.",
  description: "Description.",
  link_image: "Comma-separated list of image URLs.",
  related_products:
    "Comma-separated list of related product SKUs (item_code). Only existing FTP-synced (1C) products can be referenced — unknown or non-FTP codes are ignored. Can be set even for FTP-owned rows.",
  ...Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => index + 1).flatMap((number) => [
      [`name_characteristics${number}`, `Characteristic #${number} name (optional, up to 14 pairs).`],
      [`value_characteristics${number}`, `Characteristic #${number} value.`],
    ]),
  ),
};

const SAMPLE_ROW = {
  item_code: "TASH-0001",
  position_name: "Amortyzator przedni",
  product_type: "Amortyzator",
  price: "45.90",
  currency: FORCE_CURRENCY || DEFAULT_CURRENCY,
  quantity: "12",
  unit_of_measurement: "szt.",
  group_name: "Amortyzatory TASHIKO",
  manufacturer: "TASHIKO",
  country_of_production: "Korea",
  product_located: "Warehouse 1",
  link_image: "https://example.com/photo1.jpg, https://example.com/photo2.jpg",
  related_products: "TASH-0002, TASH-0031",
  name_characteristics1: "Marka",
  value_characteristics1: "Toyota",
};

const normalizeNumber = (value) =>
  Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", "."));

const cellToString = (cell) => {
  const raw = cell.value;
  if (raw == null) return "";
  if (typeof raw === "object") {
    if (Array.isArray(raw.richText)) {
      return raw.richText.map((part) => part.text).join("");
    }
    if (raw.text != null) return String(raw.text);
    if (raw.result != null) return String(raw.result);
    if (raw instanceof Date) return raw.toISOString();
    return "";
  }
  return String(raw);
};

const parseImportRows = async (buffer, originalName) => {
  const extension = (originalName.split(".").pop() || "").toLowerCase();
  const workbook = new ExcelJS.Workbook();
  try {
    if (extension === "csv") {
      await workbook.csv.read(Readable.from(buffer));
    } else {
      await workbook.xlsx.load(buffer);
    }
  } catch {
    return {
      error: "Could not read the file. Make sure it is a valid .xlsx or .csv file.",
    };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    return { error: "The file must contain a header row and at least one data row." };
  }

  const headerMap = new Map();
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellToString(cell).trim().toLowerCase();
    if (header) headerMap.set(header, colNumber);
  });

  if (!headerMap.has("item_code")) {
    return { error: 'The file is missing the required "item_code" column header.' };
  }

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw = {};
    let hasValue = false;
    headerMap.forEach((colNumber, header) => {
      const value = cellToString(row.getCell(colNumber)).trim();
      if (value) hasValue = true;
      raw[header] = value;
    });
    if (hasValue) rows.push({ raw, lineNumber: rowNumber });
  });

  return { rows, hasRelatedProductsColumn: headerMap.has(RELATED_PRODUCTS_KEY) };
};

const buildRowResult = (raw, lineNumber) => {
  const errors = [];
  const itemCode = String(raw.item_code || "").replace(/^﻿/, "").trim();
  const positionName = String(raw.position_name || "").trim();
  const price = normalizeNumber(raw.price);
  const quantity = normalizeNumber(raw.quantity);

  if (!itemCode) errors.push("SKU (item_code) is required");
  if (!positionName) errors.push("Name (position_name) is required");
  if (!Number.isFinite(price) || price < 0) {
    errors.push("Price must be a non-negative number");
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    errors.push("Quantity must be a non-negative whole number");
  }

  let currency = FORCE_CURRENCY;
  if (!FORCE_CURRENCY) {
    currency = String(raw.currency || "").trim().toUpperCase() || DEFAULT_CURRENCY;
    if (!ALLOWED_CURRENCIES.includes(currency)) {
      errors.push(`Currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`);
    }
  }

  if (errors.length) return { lineNumber, itemCode, errors };

  const data = { item_code: itemCode, position_name: positionName, price, quantity, currency };
  OPTIONAL_KEYS.forEach((key) => {
    if (key === RELATED_PRODUCTS_KEY) return;
    data[key] = String(raw[key] || "").trim();
  });
  data.relatedProducts = String(raw[RELATED_PRODUCTS_KEY] || "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

  return { lineNumber, itemCode, data };
};

const reconcileImportedProducts = async (validRows, hasRelatedProductsColumn) => {
  if (!validRows.length) {
    return { createdCount: 0, updatedCount: 0, skippedCount: 0, skipped: [] };
  }

  const itemCodes = validRows.map((row) => row.data.item_code);
  const relatedCodes = [
    ...new Set(validRows.flatMap((row) => row.data.relatedProducts)),
  ];
  const [existing, validRelated] = await Promise.all([
    ProductFeed.find({ item_code: { $in: itemCodes } })
      .select("_id item_code source")
      .lean(),
    relatedCodes.length
      ? ProductFeed.find({ item_code: { $in: relatedCodes }, source: "ftp" })
          .select("item_code")
          .lean()
      : [],
  ]);
  const existingByCode = new Map(existing.map((product) => [product.item_code, product]));
  const validRelatedCodes = new Set(validRelated.map((product) => product.item_code));

  const skipped = [];
  const operations = [];
  validRows.forEach((row) => {
    const itemCode = row.data.item_code;
    const relatedProducts = [
      ...new Set(
        row.data.relatedProducts.filter(
          (code) => code !== itemCode && validRelatedCodes.has(code),
        ),
      ),
    ];
    const existingProduct = existingByCode.get(itemCode);

    if (existingProduct?.source === "ftp") {
      // Related products are the only field FTP-owned rows may update via
      // import — every other field stays authoritative from the 1C sync.
      if (hasRelatedProductsColumn) {
        operations.push({
          updateOne: {
            filter: { _id: existingProduct._id },
            update: { $set: { relatedProducts } },
          },
        });
      } else {
        skipped.push({
          lineNumber: row.lineNumber,
          itemCode,
          reason: "This SKU is managed by FTP sync and cannot be modified via import",
        });
      }
      return;
    }

    const rowData = { ...row.data, relatedProducts };
    if (existingProduct) {
      operations.push({
        updateOne: {
          filter: { _id: existingProduct._id },
          update: { $set: { ...rowData, source: "admin" } },
        },
      });
    } else {
      operations.push({
        updateOne: {
          filter: { item_code: itemCode },
          update: { $set: { ...rowData, source: "admin", active: true } },
          upsert: true,
        },
      });
    }
  });

  const result = operations.length
    ? await ProductFeed.bulkWrite(operations, { ordered: false })
    : { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

  return {
    createdCount: result.upsertedCount || 0,
    updatedCount: result.matchedCount || 0,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, MAX_RECORDED_SKIPPED),
  };
};

export const importProductsFromFile = async (buffer, originalName) => {
  const { rows, hasRelatedProductsColumn, error: parseError } =
    await parseImportRows(buffer, originalName);
  if (parseError) return { success: false, message: parseError };
  if (!rows.length) return { success: false, message: "The file has no data rows" };
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      success: false,
      message: `The file has ${rows.length} rows, exceeding the limit of ${MAX_IMPORT_ROWS}`,
    };
  }

  const errors = [];
  const seenLines = new Map();
  const candidateRows = [];

  rows.forEach(({ raw, lineNumber }) => {
    const result = buildRowResult(raw, lineNumber);
    if (result.errors) {
      errors.push({
        lineNumber: result.lineNumber,
        itemCode: result.itemCode,
        message: result.errors.join("; "),
      });
      return;
    }
    const lines = seenLines.get(result.data.item_code) || [];
    lines.push(result.lineNumber);
    seenLines.set(result.data.item_code, lines);
    candidateRows.push(result);
  });

  const duplicateCodes = new Set(
    [...seenLines.entries()].filter(([, lines]) => lines.length > 1).map(([code]) => code),
  );

  const validRows = [];
  candidateRows.forEach((row) => {
    if (duplicateCodes.has(row.data.item_code)) {
      errors.push({
        lineNumber: row.lineNumber,
        itemCode: row.data.item_code,
        message: `Duplicate SKU within file (rows: ${seenLines.get(row.data.item_code).join(", ")})`,
      });
    } else {
      validRows.push(row);
    }
  });

  const summary = await reconcileImportedProducts(validRows, hasRelatedProductsColumn);

  return {
    success: true,
    totalRows: rows.length,
    ...summary,
    errorCount: errors.length,
    errors: errors.slice(0, MAX_RECORDED_ERRORS),
  };
};

const productToRow = (product) =>
  COLUMN_ORDER.map((key) => {
    if (key === RELATED_PRODUCTS_KEY) {
      return (product.relatedProducts || []).join(", ");
    }
    const value = product[key];
    return value === undefined || value === null ? "" : value;
  });

export const buildProductsWorkbook = (products) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  const headers = [...COLUMN_ORDER, "source"];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  products.forEach((product) => {
    sheet.addRow([...productToRow(product), product.source || ""]);
  });
  sheet.columns.forEach((column) => {
    column.width = 20;
  });
  return workbook;
};

export const buildImportTemplateWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.addRow(COLUMN_ORDER);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(COLUMN_ORDER.map((key) => SAMPLE_ROW[key] ?? ""));
  sheet.columns.forEach((column) => {
    column.width = 20;
  });

  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRow(["Column", "Required", "Description"]);
  instructions.getRow(1).font = { bold: true };
  COLUMN_ORDER.forEach((key) => {
    instructions.addRow([key, REQUIRED_KEYS.has(key) ? "Yes" : "No", COLUMN_DESCRIPTIONS[key] || ""]);
  });
  instructions.columns = [{ width: 24 }, { width: 12 }, { width: 80 }];

  return workbook;
};
