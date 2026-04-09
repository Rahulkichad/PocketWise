import mongoose from "mongoose";
import SubCategory from "../models/SubCategory.js";
import { EXPENSE_CATEGORIES } from "../constants/systemCategories.js";

const { Types } = mongoose;

export async function listSubCategoriesCtrl(req, res, next) {
  try {
    const { category } = req.query;
    const match = { isActive: true };
    if (category) {
      if (!EXPENSE_CATEGORIES.includes(category)) {
        const err = new Error("Invalid category");
        err.status = 400;
        throw err;
      }
      match.category = category;
    }
    match.$or = [{ userId: null }, { userId: req.user.id }];
    const items = await SubCategory.find(match)
      .sort({ category: 1, name: 1 })
      .lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function createSubCategoryCtrl(req, res, next) {
  try {
    const { name, category } = req.body;
    if (!name || !category || !EXPENSE_CATEGORIES.includes(category)) {
      const err = new Error("name and valid category are required");
      err.status = 400;
      throw err;
    }
    const doc = await SubCategory.findOneAndUpdate(
      { userId: req.user.id, category, name },
      { $set: { isSystem: false, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateSubCategoryCtrl(req, res, next) {
  try {
    const id = req.params.id;
    const update = {};
    if (req.body.name) update.name = req.body.name;
    if (typeof req.body.isActive === "boolean")
      update.isActive = req.body.isActive;
    const sc = await SubCategory.findOneAndUpdate(
      { _id: id, userId: req.user.id, isSystem: false },
      { $set: update },
      { new: true },
    ).lean();
    if (!sc) {
      const err = new Error("SubCategory not found or not editable");
      err.status = 404;
      throw err;
    }
    res.json(sc);
  } catch (err) {
    next(err);
  }
}
