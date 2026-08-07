import expressAsyncHandler from "express-async-handler";
import CrossNumbers from "../models/CrossNumbers.js";
import {
  createSearchRegex,
  getPagination,
  normalizeSearchQuery,
} from "../utils/productQuery.js";

const normalizeField = (value) => String(value ?? "").trim();

const buildPayload = (body) => {
  const article_a = normalizeField(body.article_a);
  const brand_a = normalizeField(body.brand_a);
  const article_b = normalizeField(body.article_b);
  const brand_b = normalizeField(body.brand_b);

  if (!article_a || !article_b) {
    return { error: "article_a and article_b are required" };
  }

  return {
    payload: {
      article_a,
      brand_a,
      article_b,
      brand_b,
    },
  };
};

export const getAdminCrossNumbers = expressAsyncHandler(async (req, res) => {
  try {
    const {
      q = "",
      page: pageValue,
      limit: limitValue,
    } = req.query;
    const { page, limit, skip } = getPagination(pageValue, limitValue);
    const normalizedQuery = normalizeSearchQuery(q);

    const filter = {};
    if (normalizedQuery) {
      const regex = createSearchRegex(normalizedQuery);
      filter.$or = [
        { article_a: regex },
        { brand_a: regex },
        { article_b: regex },
        { brand_b: regex },
      ];
    }

    const [crossNumbers, total] = await Promise.all([
      CrossNumbers.find(filter)
        .sort({ article_a: 1, article_b: 1 })
        .skip(skip)
        .limit(limit),
      CrossNumbers.countDocuments(filter),
    ]);

    res.status(200).json({
      crossNumbers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      query: normalizedQuery,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL SERVER ERROR" });
  }
});

export const createCrossNumber = expressAsyncHandler(async (req, res) => {
  try {
    const result = buildPayload(req.body);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const created = await CrossNumbers.create(result.payload);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL SERVER ERROR" });
  }
});

export const updateCrossNumber = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await CrossNumbers.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Cross number not found" });
    }

    const result = buildPayload(req.body);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    existing.article_a = result.payload.article_a;
    existing.brand_a = result.payload.brand_a;
    existing.article_b = result.payload.article_b;
    existing.brand_b = result.payload.brand_b;

    const updated = await existing.save();
    res.status(200).json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL SERVER ERROR" });
  }
});

export const deleteCrossNumber = expressAsyncHandler(async (req, res) => {
  try {
    const existing = await CrossNumbers.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Cross number not found" });
    }

    await existing.deleteOne();
    res.status(200).json({ message: "Cross number deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL SERVER ERROR" });
  }
});
