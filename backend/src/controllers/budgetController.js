import mongoose from "mongoose";
import Budget from "../models/Budget.js";
import Transaction from "../models/Transaction.js";
import { EXPENSE_CATEGORIES } from "../constants/systemCategories.js";

const { Types } = mongoose;

export async function listBudgetsCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const budgets = await Budget.find({ userId, month, year }).lean();

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const rowsCat = await Transaction.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: "expense",
          date: { $gte: start, $lte: end },
          category: { $in: EXPENSE_CATEGORIES },
        },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]);
    const spentCat = Object.fromEntries(
      rowsCat.map((r) => [r._id, Number(r.total || 0)]),
    );

    const rowsSub = await Transaction.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: "expense",
          date: { $gte: start, $lte: end },
          category: { $in: EXPENSE_CATEGORIES },
        },
      },
      {
        $group: {
          _id: { category: "$category", subCategoryId: "$subCategoryId" },
          total: { $sum: "$amount" },
        },
      },
    ]);
    const spentSub = Object.fromEntries(
      rowsSub.map((r) => [
        `${r._id.category}:${String(r._id.subCategoryId)}`,
        Number(r.total || 0),
      ]),
    );

    const subIds = budgets
      .filter((b) => b.subCategoryId)
      .map((b) => b.subCategoryId);
    const subs = subIds.length
      ? await mongoose
          .model("SubCategory")
          .find({ _id: { $in: subIds } })
          .lean()
      : [];
    const subNameMap = Object.fromEntries(
      subs.map((s) => [String(s._id), s.name]),
    );

    const result = budgets.map((b) => {
      const key = b.subCategoryId
        ? `${b.category}:${String(b.subCategoryId)}`
        : null;
      const spent = key ? spentSub[key] || 0 : spentCat[b.category] || 0;
      const remaining = Math.max(0, Number(b.limit || 0) - spent);
      return {
        ...b,
        spent,
        remaining,
        subCategoryName: b.subCategoryId
          ? subNameMap[String(b.subCategoryId)] || ""
          : "",
      };
    });
    res.json({ items: result, month, year });
  } catch (err) {
    next(err);
  }
}

export async function upsertBudgetCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const { category, limit, month, year, subCategoryId } = req.body;
    if (!category || !EXPENSE_CATEGORIES.includes(category)) {
      const err = new Error("category must be Needs/Wants/Savings");
      err.status = 400;
      throw err;
    }
    const lim = Number(limit);
    if (isNaN(lim) || lim < 0) {
      const err = new Error("limit must be a non-negative number");
      err.status = 400;
      throw err;
    }
    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year) || new Date().getFullYear();
    const update = { limit: lim };
    let filter = { userId, category, month: m, year: y };
    if (subCategoryId) {
      const SubCategory = mongoose.model("SubCategory");
      const sub = await SubCategory.findById(subCategoryId).lean();
      if (!sub || !sub.isActive || sub.category !== category) {
        const err = new Error("Invalid subCategoryId for category");
        err.status = 400;
        throw err;
      }
      filter.subCategoryId = subCategoryId;
      update.subCategoryId = subCategoryId;
    } else {
      filter.subCategoryId = null;
      update.subCategoryId = null;
    }
    const doc = await Budget.findOneAndUpdate(
      filter,
      { $set: update },
      { upsert: true, new: true },
    ).lean();
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}
