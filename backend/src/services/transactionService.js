import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";

const { Types } = mongoose;

export async function createTransaction(userId, payload) {
  // Validate required fields
  if (
    !payload.type ||
    !["income", "expense", "transfer"].includes(payload.type)
  ) {
    const err = new Error("Type must be income, expense, or transfer");
    err.status = 400;
    throw err;
  }

  if (!payload.amount || isNaN(Number(payload.amount))) {
    const err = new Error("Amount must be a valid number");
    err.status = 400;
    throw err;
  }

  if (!payload.date) {
    const err = new Error("Date is required");
    err.status = 400;
    throw err;
  }

  // Clean and validate amount - ensure it's a number
  const amount = Number(payload.amount);
  if (amount <= 0) {
    const err = new Error("Amount must be greater than 0");
    err.status = 400;
    throw err;
  }

  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;

  // Build transaction body
  const body = {
    userId: userIdObj,
    type: payload.type,
    amount: amount, // Always a number
    date: new Date(payload.date),
    description: payload.description || payload.merchant || "",
    paymentMethod: payload.paymentMethod || "other",
    notes: payload.notes || "",
  };

  if (payload.type === "income") {
    body.category = "Income";
    body.subType = payload.subType || payload.incomeSource || "";
    body.subCategoryId = null;
  } else if (payload.type === "transfer") {
    body.category = "Transfer";
    body.subType = payload.subType || "";
    body.subCategoryId = null;
  } else if (payload.type === "expense") {
    body.category = payload.category;
    body.subCategoryId = payload.subCategoryId || null;
    body.subType = "";
    if (
      !body.category ||
      !["Needs", "Wants", "Savings"].includes(body.category)
    ) {
      const err = new Error(
        "Expense category must be one of Needs/Wants/Savings",
      );
      err.status = 400;
      throw err;
    }
    if (!body.subCategoryId) {
      const err = new Error(
        "subCategoryId is required for expense in Needs/Wants/Savings",
      );
      err.status = 400;
      throw err;
    }
    const SubCategory = mongoose.model("SubCategory");
    const sub = await SubCategory.findById(body.subCategoryId).lean();
    if (!sub || !sub.isActive || sub.category !== body.category) {
      const err = new Error("Invalid subCategoryId mapping for category");
      err.status = 400;
      throw err;
    }
  }

  const tx = await Transaction.create(body);
  return tx.toJSON();
}

export async function getTransactions(userId, filters = {}) {
  const {
    q,
    from,
    to,
    type,
    category,
    paymentMethod,
    minAmount,
    maxAmount,
    sortBy = "date",
    sortDir = "desc",
    limit = 100,
    offset = 0,
  } = filters;

  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const query = { userId: userIdObj };

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  if (type) query.type = type;
  if (category) query.category = category;
  if (paymentMethod) query.paymentMethod = paymentMethod;

  if (minAmount || maxAmount) {
    query.amount = {};
    if (minAmount) query.amount.$gte = Number(minAmount);
    if (maxAmount) query.amount.$lte = Number(maxAmount);
  }

  if (q) {
    query.$or = [
      { description: new RegExp(q, "i") },
      { notes: new RegExp(q, "i") },
    ];
  }

  const sort = { [sortBy]: sortDir === "asc" ? 1 : -1 };
  const txs = await Transaction.find(query)
    .sort(sort)
    .skip(Number(offset) || 0)
    .limit(Math.min(Number(limit) || 100, 500));

  // Ensure all amounts are numbers
  return txs.map((t) => {
    const j = t.toJSON();
    j.amount = typeof j.amount === "number" ? j.amount : Number(j.amount || 0);
    return j;
  });
}

export async function updateTransaction(userId, id, payload) {
  const update = { ...payload };

  // Ensure amount is a number if provided
  if (update.amount != null) {
    update.amount = Number(update.amount);
    if (isNaN(update.amount) || update.amount <= 0) {
      const err = new Error("Amount must be a valid positive number");
      err.status = 400;
      throw err;
    }
  }

  if (update.type && !["income", "expense", "transfer"].includes(update.type)) {
    const err = new Error("Type must be income, expense, or transfer");
    err.status = 400;
    throw err;
  }

  if (update.type === "income") {
    update.category = "Income";
    update.subCategoryId = null;
  } else if (update.type === "transfer") {
    update.category = "Transfer";
    update.subCategoryId = null;
  } else if (update.type === "expense") {
    if (!update.category) {
      const err = new Error("Expense category is required");
      err.status = 400;
      throw err;
    }
    if (!["Needs", "Wants", "Savings"].includes(update.category)) {
      const err = new Error("Expense category must be Needs/Wants/Savings");
      err.status = 400;
      throw err;
    }
    if (update.subCategoryId == null) {
      const err = new Error(
        "subCategoryId is required for expense in Needs/Wants/Savings",
      );
      err.status = 400;
      throw err;
    }
    const SubCategory = mongoose.model("SubCategory");
    const sub = await SubCategory.findById(update.subCategoryId).lean();
    if (!sub || !sub.isActive || sub.category !== update.category) {
      const err = new Error("Invalid subCategoryId mapping for category");
      err.status = 400;
      throw err;
    }
  }

  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;

  const tx = await Transaction.findOneAndUpdate(
    { _id: id, userId: userIdObj },
    update,
    { new: true },
  );

  if (!tx) {
    const err = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }

  return tx.toJSON();
}

export async function deleteTransaction(userId, id) {
  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const result = await Transaction.deleteOne({ _id: id, userId: userIdObj });
  if (result.deletedCount === 0) {
    const err = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }
  return { success: true };
}

export async function markReviewed(userId, id) {
  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const tx = await Transaction.findOneAndUpdate(
    { _id: id, userId: userIdObj },
    { reviewedAt: new Date() },
    { new: true },
  );
  if (!tx) {
    const err = new Error("Transaction not found");
    err.status = 404;
    throw err;
  }
  return tx.toJSON();
}

export async function bulkAction(userId, action, transactionIds) {
  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;

  // Convert transaction IDs to ObjectIds
  const txIds = transactionIds.map((id) =>
    Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id,
  );

  let update;
  switch (action) {
    case "delete":
      const result = await Transaction.deleteMany({
        _id: { $in: txIds },
        userId: userIdObj,
      });
      return { deletedCount: result.deletedCount };

    case "markReviewed":
      update = await Transaction.updateMany(
        { _id: { $in: txIds }, userId: userIdObj },
        { reviewedAt: new Date() },
      );
      return { modifiedCount: update.modifiedCount };

    case "unreview":
      update = await Transaction.updateMany(
        { _id: { $in: txIds }, userId: userIdObj },
        { $unset: { reviewedAt: 1 } },
      );
      return { modifiedCount: update.modifiedCount };

    default:
      const err = new Error(`Invalid bulk action: ${action}`);
      err.status = 400;
      throw err;
  }
}
