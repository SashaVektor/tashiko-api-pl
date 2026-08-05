import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import csv from "csv-parser";
import ftp from "basic-ftp";
import ProductFeed from "../models/ProductFeed.js";
import ProductSyncLock from "../models/ProductSyncLock.js";
import ProductSyncRun from "../models/ProductSyncRun.js";

const REMOTE_FILE = "/Products_PL.csv";
const BASE_CURRENCY = "PLN";
const LOCK_ID = "ftp-product-sync";
const LOCK_DURATION_MS = 30 * 60 * 1000;
const MINIMUM_DEFAULT_ROWS = 50;
const MINIMUM_EXPORT_RATIO = 0.5;
const MAX_FILE_AGE_HOURS = 48;
const MAX_INVALID_ROW_RATIO = 0.05;
const MAX_RECORDED_CONFLICTS = 500;
const MAX_RECORDED_INVALID_ROWS = 100;
const DEBUG_SNAPSHOT_RELATIVE_PATH = path.join("data", "products.csv");

export class ProductSyncInProgressError extends Error {}

const normalizeNumber = (value) =>
  Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", "."));

const validateRow = (row, lineNumber) => {
  const itemCode = String(row.item_code || "")
    .replace(/^\uFEFF/, "")
    .trim();
  const positionName = String(row.position_name || "").trim();
  const rawQuantity = String(row.quantity ?? "").trim();
  const rawPrice = String(row.price ?? "").trim();
  const parsedQuantity = normalizeNumber(row.quantity);
  const quantity = Math.floor(parsedQuantity);
  const price = normalizeNumber(row.price);

  let reason = "";
  if (!itemCode) reason = "missing_sku";
  else if (!positionName) reason = "missing_name";
  else if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
    reason = "invalid_quantity";
  } else if (!Number.isFinite(price) || price < 0) {
    reason = "invalid_price";
  } else if (Object.keys(row).some((key) => /^_\d+$/.test(key))) {
    reason = "unexpected_columns";
  }

  if (reason) {
    return {
      invalidRow: {
        lineNumber,
        itemCode,
        reason,
        quantity: rawQuantity,
        price: rawPrice,
      },
    };
  }

  return {
    product: {
      item_code: itemCode,
      position_name: positionName,
      quantity,
      price,
    },
  };
};

export const parseProductCSV = (filePath) =>
  new Promise((resolve, reject) => {
    const products = [];
    const invalidRows = [];
    const seenCodes = new Set();
    const duplicateCodes = new Set();
    let lineNumber = 0;
    let totalRows = 0;

    fs.createReadStream(filePath)
      .pipe(
        csv({
          separator: ";",
          headers: ["item_code", "position_name", "quantity", "price"],
          strict: false,
        }),
      )
      .on("data", (row) => {
        lineNumber += 1;
        const values = Object.values(row).map((value) =>
          String(value ?? "").trim(),
        );
        if (values.every((value) => !value)) return;

        const itemCode = String(row.item_code || "")
          .replace(/^\uFEFF/, "")
          .trim();
        if (itemCode.toLowerCase() === "item_code") return;

        totalRows += 1;
        if (seenCodes.has(itemCode)) duplicateCodes.add(itemCode);
        if (itemCode) seenCodes.add(itemCode);

        const result = validateRow(row, lineNumber);
        if (result.invalidRow) invalidRows.push(result.invalidRow);
        else products.push(result.product);
      })
      .on("error", reject)
      .on("end", () => {
        if (duplicateCodes.size) {
          reject(
            new Error(
              `CSV contains duplicate SKUs: ${[...duplicateCodes]
                .slice(0, 20)
                .join(", ")}`,
            ),
          );
          return;
        }
        resolve({ products, invalidRows, totalRows });
      });
  });

const acquireLock = async () => {
  const now = new Date();
  const token = randomUUID();
  try {
    await ProductSyncLock.updateOne(
      { _id: LOCK_ID },
      { $setOnInsert: { lockedUntil: new Date(0), token: "" } },
      { upsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const lock = await ProductSyncLock.findOneAndUpdate(
    { _id: LOCK_ID, lockedUntil: { $lte: now } },
    {
      $set: {
        token,
        lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
      },
    },
    { new: true },
  );
  if (!lock) {
    throw new ProductSyncInProgressError(
      "Product synchronization is already running",
    );
  }
  return token;
};

const releaseLock = async (token) => {
  if (!token) return;
  await ProductSyncLock.updateOne(
    { _id: LOCK_ID, token },
    { $set: { token: "", lockedUntil: new Date(0) } },
  );
};

const downloadCSV = async (directory) => {
  const client = new ftp.Client();
  const localPath = path.join(directory, path.basename(REMOTE_FILE));
  try {
    await client.access({
      host: process.env.FTP_HOST,
      port: Number(process.env.FTP_PORT),
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: process.env.FTP_SECURE === "true",
    });
    const fileModifiedAt = await client.lastMod(REMOTE_FILE).catch(() => null);
    await client.downloadTo(localPath, REMOTE_FILE);
    return { localPath, fileModifiedAt };
  } finally {
    client.close();
  }
};

const saveDebugSnapshot = async (sourcePath) => {
  const destinationPath = path.resolve(DEBUG_SNAPSHOT_RELATIVE_PATH);
  try {
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
    return { saved: true, path: DEBUG_SNAPSHOT_RELATIVE_PATH };
  } catch (error) {
    console.warn("[Product sync] Failed to save CSV snapshot:", error.message);
    return {
      saved: false,
      path: DEBUG_SNAPSHOT_RELATIVE_PATH,
      error: error.message,
    };
  }
};

const assertSafeExport = async ({ products, invalidRows, totalRows }) => {
  const minimumRows = Number(
    process.env.PRODUCT_SYNC_MIN_ROWS || MINIMUM_DEFAULT_ROWS,
  );
  if (totalRows < minimumRows) {
    throw new Error(
      `CSV rejected: ${totalRows} rows is below the safety minimum of ${minimumRows}`,
    );
  }

  const existingFtpCount = await ProductFeed.countDocuments({ source: "ftp" });
  if (
    existingFtpCount > minimumRows &&
    totalRows < existingFtpCount * MINIMUM_EXPORT_RATIO
  ) {
    throw new Error(
      `CSV rejected: ${totalRows} rows is less than 50% of the ${existingFtpCount} FTP products in the database`,
    );
  }

  const configuredRatio = Number(
    process.env.PRODUCT_SYNC_MAX_INVALID_ROW_RATIO ?? MAX_INVALID_ROW_RATIO,
  );
  const maximumInvalidRatio =
    Number.isFinite(configuredRatio) &&
    configuredRatio >= 0 &&
    configuredRatio <= 1
      ? configuredRatio
      : MAX_INVALID_ROW_RATIO;
  const invalidRatio = totalRows ? invalidRows.length / totalRows : 1;
  if (invalidRatio > maximumInvalidRatio) {
    throw new Error(
      `CSV rejected: ${invalidRows.length} of ${totalRows} rows are invalid (${(invalidRatio * 100).toFixed(2)}%), exceeding the ${(maximumInvalidRatio * 100).toFixed(2)}% safety limit`,
    );
  }

  if (!products.length) {
    throw new Error("CSV rejected: no valid product rows");
  }
};

const assertFreshExport = (fileModifiedAt) => {
  if (
    !(fileModifiedAt instanceof Date) ||
    Number.isNaN(fileModifiedAt.valueOf())
  ) {
    throw new Error("CSV rejected: FTP modification time is unavailable");
  }
  const configuredHours = Number(
    process.env.PRODUCT_SYNC_MAX_FILE_AGE_HOURS || MAX_FILE_AGE_HOURS,
  );
  const maximumAgeHours =
    Number.isFinite(configuredHours) && configuredHours > 0
      ? configuredHours
      : MAX_FILE_AGE_HOURS;
  const ageMs = Date.now() - fileModifiedAt.getTime();
  if (ageMs > maximumAgeHours * 60 * 60 * 1000) {
    throw new Error(
      `CSV rejected: FTP file is older than ${maximumAgeHours} hours`,
    );
  }
};

const reconcileProducts = async (products, invalidRows) => {
  const itemCodes = products.map(({ item_code: itemCode }) => itemCode);
  const invalidItemCodes = [
    ...new Set(
      invalidRows
        .map(({ itemCode }) => itemCode)
        .filter((itemCode) => itemCode),
    ),
  ];
  const exportedItemCodes = [...new Set([...itemCodes, ...invalidItemCodes])];
  const existingProducts = await ProductFeed.find({
    item_code: { $in: itemCodes },
  })
    .select("_id item_code source")
    .lean();

  const existingByCode = existingProducts.reduce((result, product) => {
    const matches = result.get(product.item_code) || [];
    matches.push(product);
    result.set(product.item_code, matches);
    return result;
  }, new Map());

  const conflicts = [];
  const operations = [];
  for (const product of products) {
    const existing = existingByCode.get(product.item_code) || [];
    if (existing.length > 1) {
      conflicts.push({
        itemCode: product.item_code,
        reason: "duplicate_database_sku",
      });
      continue;
    }
    if (existing[0]?.source === "admin") {
      conflicts.push({
        itemCode: product.item_code,
        reason: "admin_owned_sku",
      });
      continue;
    }

    if (existing[0]) {
      operations.push({
        updateOne: {
          filter: { _id: existing[0]._id, source: "ftp" },
          update: {
            $set: {
              price: product.price,
              quantity: product.quantity,
              currency: BASE_CURRENCY,
              active: true,
            },
          },
        },
      });
    } else {
      operations.push({
        updateOne: {
          filter: { item_code: product.item_code },
          update: {
            $setOnInsert: {
              source: "ftp",
              active: true,
              item_code: product.item_code,
              position_name: product.position_name,
              price: product.price,
              currency: BASE_CURRENCY,
              quantity: product.quantity,
            },
          },
          upsert: true,
        },
      });
    }
  }

  const result = operations.length
    ? await ProductFeed.bulkWrite(operations, { ordered: false })
    : {
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
      };
  const [invalidDisabled, missingDisabled] = await Promise.all([
    invalidItemCodes.length
      ? ProductFeed.updateMany(
          { source: "ftp", item_code: { $in: invalidItemCodes } },
          { $set: { quantity: 0, active: false } },
        )
      : { modifiedCount: 0 },
    ProductFeed.updateMany(
      {
        source: "ftp",
        item_code: { $nin: exportedItemCodes },
        $or: [{ quantity: { $ne: 0 } }, { active: { $ne: false } }],
      },
      { $set: { quantity: 0, active: false } },
    ),
  ]);

  return {
    createdCount: result.upsertedCount || 0,
    updatedCount: result.modifiedCount || 0,
    matchedCount: result.matchedCount || 0,
    disabledCount:
      (invalidDisabled.modifiedCount || 0) +
      (missingDisabled.modifiedCount || 0),
    zeroPriceCount: products.filter(({ price }) => price <= 0).length,
    conflictCount: conflicts.length,
    conflicts: conflicts.slice(0, MAX_RECORDED_CONFLICTS),
  };
};

export const syncProductsFromFTP = async (trigger = "admin") => {
  let token;
  let tempDirectory;
  let run;
  let debugSnapshot;
  const startedAt = new Date();

  try {
    token = await acquireLock();
    run = await ProductSyncRun.create({
      trigger,
      status: "running",
      fileName: path.basename(REMOTE_FILE),
      startedAt,
    });
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "tashiko-sync-"));
    const { localPath, fileModifiedAt } = await downloadCSV(tempDirectory);
    if (trigger === "admin") {
      debugSnapshot = await saveDebugSnapshot(localPath);
    }
    run.fileModifiedAt = fileModifiedAt;
    assertFreshExport(fileModifiedAt);
    const parsed = await parseProductCSV(localPath);
    Object.assign(run, {
      totalRows: parsed.totalRows,
      invalidRowCount: parsed.invalidRows.length,
      invalidRows: parsed.invalidRows.slice(0, MAX_RECORDED_INVALID_ROWS),
    });
    await assertSafeExport(parsed);
    const summary = await reconcileProducts(
      parsed.products,
      parsed.invalidRows,
    );

    Object.assign(run, {
      status: "completed",
      completedAt: new Date(),
      fileModifiedAt,
      ...summary,
    });
    await run.save();
    return { ...run.toObject(), debugSnapshot };
  } catch (error) {
    if (run) {
      run.status = "failed";
      run.completedAt = new Date();
      run.error = error.message;
      await run.save().catch((saveError) => {
        console.error("[Product sync] Failed to save error log:", saveError);
      });
    }
    if (debugSnapshot && error && typeof error === "object") {
      error.debugSnapshot = debugSnapshot;
    }
    throw error;
  } finally {
    if (tempDirectory) {
      await rm(tempDirectory, { recursive: true, force: true }).catch(
        (cleanupError) => {
          console.error(
            "[Product sync] Failed to remove temp files:",
            cleanupError,
          );
        },
      );
    }
    await releaseLock(token).catch((lockError) => {
      console.error("[Product sync] Failed to release lock:", lockError);
    });
  }
};

const SYNC_HISTORY_SORT_FIELDS = new Set([
  "startedAt",
  "completedAt",
  "fileModifiedAt",
  "createdAt",
]);
const SYNC_HISTORY_STATUSES = new Set(["running", "completed", "failed"]);

export const getProductSyncHistory = async ({
  page = 1,
  limit = 20,
  sortBy = "startedAt",
  sortOrder = "desc",
  status,
} = {}) => {
  const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || 20, 1),
    100,
  );
  const safeSortBy = SYNC_HISTORY_SORT_FIELDS.has(sortBy)
    ? sortBy
    : "startedAt";
  const safeSortOrder = sortOrder === "asc" ? 1 : -1;
  const filter = SYNC_HISTORY_STATUSES.has(status) ? { status } : {};

  const [items, total] = await Promise.all([
    ProductSyncRun.find(filter)
      .sort({ [safeSortBy]: safeSortOrder, _id: safeSortOrder })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .lean(),
    ProductSyncRun.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
    sort: {
      sortBy: safeSortBy,
      sortOrder: safeSortOrder === 1 ? "asc" : "desc",
    },
  };
};
