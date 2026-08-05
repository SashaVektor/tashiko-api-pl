import expressAsyncHandler from "express-async-handler";
import Category from "../models/Category.js";

export const getCategories = expressAsyncHandler(async (req, res) => {
  try {
    const caterories = await Category.find().sort({ order: 1, createdAt: 1 });
    res.send(caterories);
  } catch (err) {
    res.status(401).send({ message: "Что-то пошло не так!" });
  }
});

export const getFilteredCategories = expressAsyncHandler(async (req, res) => {
  try {
    const caterories = await Category.find({ isActive: true }).sort({
      order: 1,
      createdAt: 1,
    });

    if (!caterories) {
      res.status(401).send({ message: "Категорий не существует!" });
    } else {
      res.send(caterories);
    }
  } catch (err) {
    res.status(401).send({ message: "Что-то пошло не так!" });
  }
});

export const createCategory = expressAsyncHandler(async (req, res) => {
  try {
    const category = req.body;
    const lastCategory = await Category.findOne().sort({ order: -1 });
    const newCategory = new Category({
      name: category.name,
      slug: category.slug,
      image: category.image,
      order: (lastCategory?.order ?? -1) + 1,
    });
    const prod = await newCategory.save();
    if (prod) {
      res.status(200).send({ message: "Категория успешно создана!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const reorderCategories = expressAsyncHandler(async (req, res) => {
  const categoryIds = req.body.categoryIds;
  if (
    !Array.isArray(categoryIds) ||
    categoryIds.length === 0 ||
    new Set(categoryIds).size !== categoryIds.length ||
    categoryIds.some((id) => !/^[a-f\d]{24}$/i.test(String(id)))
  ) {
    return res.status(400).send({ message: "Некорректный порядок категорий!" });
  }

  const existingCount = await Category.countDocuments({
    _id: { $in: categoryIds },
  });
  if (existingCount !== categoryIds.length) {
    return res.status(400).send({ message: "Категория не найдена!" });
  }

  await Category.bulkWrite(
    categoryIds.map((id, order) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order } } },
    })),
  );

  res.send({ message: "Порядок категорий обновлён!" });
});

export const editCategory = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    
    if (category) {
      category.isActive = String(req.body.isActive) ? req.body.isActive : category.isActive;

      const updatedCategory = await category.save();

      if (!updatedCategory) {
        res.status(403).send({ message: "Что-то пошло не так!" });
        return;
      }

      res.status(200).send({ message: "Статус категории обновлён!" });
    } else {
      return res.status(404).send({ message: "Категория не найдена!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const removeCaterory = expressAsyncHandler(async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (category) {
      await category.deleteOne();
      res.send({ message: "Категория успешно удалена!" });
    } else {
      res.status(404).send({ message: "Категория не найдена!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});
