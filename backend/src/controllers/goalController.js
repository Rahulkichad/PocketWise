import mongoose from "mongoose";
import Goal from "../models/Goal.js";
import SubCategory from "../models/SubCategory.js";
import Transaction from "../models/Transaction.js";

const { Types } = mongoose;

export async function listGoalsCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const goals = await Goal.find({ userId }).lean();
    const subIds = goals.map((g) => g.linkedSubCategoryId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const rows = await Transaction.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: "expense",
          category: "Savings",
          subCategoryId: { $in: subIds },
        },
      },
      { $group: { _id: "$subCategoryId", total: { $sum: "$amount" } } },
    ]);
    const monthlyRows = await Transaction.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          type: "expense",
          category: "Savings",
          subCategoryId: { $in: subIds },
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: "$subCategoryId", total: { $sum: "$amount" } } },
    ]);
    const progMap = Object.fromEntries(
      rows.map((r) => [String(r._id), Number(r.total || 0)]),
    );
    const monthlyMap = Object.fromEntries(
      monthlyRows.map((r) => [String(r._id), Number(r.total || 0)]),
    );
    const items = goals.map((g) => ({
      ...g,
      progress: progMap[String(g.linkedSubCategoryId)] || 0,
      monthlyActual: monthlyMap[String(g.linkedSubCategoryId)] || 0,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function createGoalCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, targetAmount, linkedSubCategoryId, targetDate, startDate } =
      req.body;
    const amt = Number(targetAmount);
    if (!name || isNaN(amt) || amt <= 0 || !linkedSubCategoryId) {
      const err = new Error(
        "name, targetAmount (>0), linkedSubCategoryId are required",
      );
      err.status = 400;
      throw err;
    }
    const sub = await SubCategory.findById(linkedSubCategoryId).lean();
    if (!sub || sub.category !== "Savings" || !sub.isActive) {
      const err = new Error(
        "linkedSubCategoryId must be an active Savings subcategory",
      );
      err.status = 400;
      throw err;
    }
    const payload = { userId, name, targetAmount: amt, linkedSubCategoryId };
    if (targetDate) payload.targetDate = new Date(targetDate);
    if (startDate) payload.startDate = new Date(startDate);
    const doc = await Goal.create(payload);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateGoalCtrl(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await Goal.findOne({
      _id: id,
      userId: req.user.id,
    }).lean();
    if (!existing) {
      const err = new Error("Goal not found");
      err.status = 404;
      throw err;
    }
    const update = {};
    if (req.body.name) update.name = req.body.name;
    if (req.body.linkedSubCategoryId) {
      const requested = req.body.linkedSubCategoryId;
      if (String(requested) !== String(existing.linkedSubCategoryId)) {
        const progressCount = await Transaction.countDocuments({
          userId: existing.userId,
          type: "expense",
          category: "Savings",
          subCategoryId: existing.linkedSubCategoryId,
        });
        if (progressCount > 0) {
          const err = new Error(
            "Cannot change linked subcategory once goal is in progress",
          );
          err.status = 400;
          throw err;
        }
        const sub = await SubCategory.findById(requested).lean();
        if (!sub || sub.category !== "Savings" || !sub.isActive) {
          const err = new Error(
            "linkedSubCategoryId must be an active Savings subcategory",
          );
          err.status = 400;
          throw err;
        }
        update.linkedSubCategoryId = requested;
      }
    }
    if (req.body.targetAmount != null) {
      const amt = Number(req.body.targetAmount);
      if (isNaN(amt) || amt <= 0) {
        const err = new Error("targetAmount must be a positive number");
        err.status = 400;
        throw err;
      }
      update.targetAmount = amt;
    }
    if (req.body.targetDate) {
      update.targetDate = new Date(req.body.targetDate);
    }
    if (req.body.startDate) {
      update.startDate = new Date(req.body.startDate);
    }
    if (req.body.investmentType) {
      const allowed = ["SIP", "PPF", "NPS", "ELSS"];
      if (!allowed.includes(req.body.investmentType)) {
        const err = new Error("Invalid investmentType");
        err.status = 400;
        throw err;
      }
      update.investmentType = req.body.investmentType;
    }
    if (req.body.monthlyContribution != null) {
      const amt = Number(req.body.monthlyContribution);
      if (isNaN(amt) || amt < 0) {
        const err = new Error(
          "monthlyContribution must be a non-negative number",
        );
        err.status = 400;
        throw err;
      }
      update.monthlyContribution = amt;
    }
    const goal = await Goal.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: update },
      { new: true },
    ).lean();
    res.json(goal);
  } catch (err) {
    next(err);
  }
}

export async function deleteGoalCtrl(req, res, next) {
  try {
    const id = req.params.id;
    const result = await Goal.deleteOne({ _id: id, userId: req.user.id });
    if (result.deletedCount === 0) {
      const err = new Error("Goal not found");
      err.status = 404;
      throw err;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
