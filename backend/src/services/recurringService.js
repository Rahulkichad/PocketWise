import mongoose from "mongoose";
import Recurring from "../models/Recurring.js";
import { createTransaction } from "./transactionService.js";
import Transaction from "../models/Transaction.js";

const { Types } = mongoose;

function parseTimeToDate(baseDate, timeStr) {
  const [hh, mm] = (timeStr || "09:00").split(":").map((v) => Number(v));
  const d = new Date(baseDate);
  d.setHours(hh || 9, mm || 0, 0, 0);
  return d;
}

function nextMonthlyDate(current, dayOfMonth, timeStr) {
  const d = new Date(current);
  const next = new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    Math.min(dayOfMonth || 1, 28),
  );
  return parseTimeToDate(next, timeStr);
}

function nextWeeklyDate(current, timeStr) {
  const next = new Date(current);
  next.setDate(next.getDate() + 7);
  return parseTimeToDate(next, timeStr);
}

function nextYearlyDate(current, dayOfMonth, timeStr) {
  const d = new Date(current);
  const baseMonth = d.getMonth();
  const next = new Date(
    d.getFullYear() + 1,
    baseMonth,
    Math.min(dayOfMonth || 1, 28),
  );
  return parseTimeToDate(next, timeStr);
}

function initialNextDueDate(cadence, base, dayOfMonth, timeStr, now) {
  if (cadence === "monthly") {
    const thisMonth = parseTimeToDate(
      new Date(
        base.getFullYear(),
        base.getMonth(),
        Math.min(dayOfMonth || 1, 28),
      ),
      timeStr,
    );
    if (thisMonth > now) return thisMonth;
    return nextMonthlyDate(thisMonth, dayOfMonth, timeStr);
  }
  if (cadence === "weekly") {
    const first = parseTimeToDate(base, timeStr);
    if (first > now) return first;
    return nextWeeklyDate(first, timeStr);
  }
  const thisYear = parseTimeToDate(
    new Date(
      base.getFullYear(),
      base.getMonth(),
      Math.min(dayOfMonth || 1, 28),
    ),
    timeStr,
  );
  if (thisYear > now) return thisYear;
  return nextYearlyDate(thisYear, dayOfMonth, timeStr);
}

function advanceNextDueDate(r, now) {
  let next = r.nextDueDate ? new Date(r.nextDueDate) : new Date(now);
  if (r.cadence === "monthly") {
    do {
      next = nextMonthlyDate(next, r.dayOfMonth || 1, r.timeOfDay || "09:00");
    } while (next <= now);
    return next;
  }
  if (r.cadence === "weekly") {
    do {
      next = nextWeeklyDate(next, r.timeOfDay || "09:00");
    } while (next <= now);
    return next;
  }
  do {
    next = nextYearlyDate(next, r.dayOfMonth || 1, r.timeOfDay || "09:00");
  } while (next <= now);
  return next;
}

function monthBounds(now) {
  const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start: s, end: e };
}

export async function listRecurring(userId) {
  const userObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  return Recurring.find({ user: userObj }).sort({ nextDueDate: 1 }).lean();
}

export async function createRecurring(userId, payload) {
  const {
    name,
    cadence = "monthly",
    typicalAmount,
    type,
    category,
    subCategoryId,
    paymentMethod = "other",
    description = "",
    dayOfMonth = 1,
    timeOfDay = "09:00",
    startDate,
  } = payload || {};
  if (!name || !type || !category) {
    const err = new Error("name, type, category are required");
    err.status = 400;
    throw err;
  }
  const amt = Number(typicalAmount || 0);
  if (isNaN(amt) || amt <= 0) {
    const err = new Error("typicalAmount must be a positive number");
    err.status = 400;
    throw err;
  }
  if (
    type === "expense" &&
    ["Needs", "Wants", "Savings"].includes(category) &&
    !subCategoryId
  ) {
    const err = new Error(
      "subCategoryId is required for expense in Needs/Wants/Savings",
    );
    err.status = 400;
    throw err;
  }
  const base = startDate ? new Date(startDate) : new Date();
  const now = new Date();
  const nextDueDate = initialNextDueDate(
    cadence,
    base,
    Number(dayOfMonth || 1),
    timeOfDay,
    now,
  );
  const doc = await Recurring.create({
    user: userId,
    name,
    cadence,
    typicalAmount: amt,
    type,
    category,
    subCategoryId: subCategoryId || null,
    paymentMethod,
    description,
    dayOfMonth: Number(dayOfMonth || 1),
    timeOfDay,
    nextDueDate,
    active: true,
  });
  return doc.toJSON();
}

export async function updateRecurring(userId, id, payload) {
  const update = {};
  for (const k of [
    "name",
    "cadence",
    "type",
    "category",
    "subCategoryId",
    "paymentMethod",
    "description",
    "dayOfMonth",
    "timeOfDay",
    "active",
  ]) {
    if (payload[k] !== undefined) update[k] = payload[k];
  }
  if (payload.typicalAmount != null) {
    const amt = Number(payload.typicalAmount);
    if (isNaN(amt) || amt <= 0) {
      const err = new Error("typicalAmount must be a positive number");
      err.status = 400;
      throw err;
    }
    update.typicalAmount = amt;
  }
  if (payload.nextDueDate) update.nextDueDate = new Date(payload.nextDueDate);
  const userObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const doc = await Recurring.findOneAndUpdate(
    { _id: id, user: userObj },
    { $set: update },
    { new: true },
  ).lean();
  if (!doc) {
    const err = new Error("Recurring not found");
    err.status = 404;
    throw err;
  }
  return doc;
}

export async function deleteRecurring(userId, id) {
  const userObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const result = await Recurring.deleteOne({ _id: id, user: userObj });
  if (result.deletedCount === 0) {
    const err = new Error("Recurring not found");
    err.status = 404;
    throw err;
  }
  return { success: true };
}

export async function runDueRecurring(userId) {
  const now = new Date();
  const userObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const items = await Recurring.find({
    user: userObj,
    active: true,
    nextDueDate: { $lte: now },
  }).lean();
  const allActive = await Recurring.find({
    user: userObj,
    active: true,
  })
    .lean()
    .catch(() => []);
  const created = [];
  const errors = [];
  for (const r of items) {
    try {
      const payload = {
        type: r.type,
        amount: Number(r.typicalAmount || 0),
        date: new Date(),
        description: r.description || r.name,
        paymentMethod: r.paymentMethod || "other",
        category: r.category,
        subCategoryId: r.subCategoryId || null,
        notes: "Auto-generated by recurring rule",
      };
      const tx = await createTransaction(userObj, payload);
      created.push(tx);
      const nextDate = advanceNextDueDate(r, now);
      await Recurring.updateOne(
        { _id: r._id },
        {
          $set: { nextDueDate: nextDate, lastRunAt: now },
          $push: { linkedTransactionIds: tx._id ? tx._id : undefined },
        },
      );
    } catch (e) {
      errors.push({ id: r._id, message: e?.message || "error" });
    }
  }
  const monthlyMissing = (allActive || []).filter(
    (r) =>
      r.cadence === "monthly" &&
      (!r.nextDueDate || new Date(r.nextDueDate) > now),
  );
  const { start, end } = monthBounds(now);
  for (const r of monthlyMissing) {
    try {
      const existsLinked =
        r.linkedTransactionIds && r.linkedTransactionIds.length
          ? await Transaction.findOne({
              _id: { $in: r.linkedTransactionIds },
              userId: userObj,
              date: { $gte: start, $lt: end },
            }).lean()
          : null;
      if (existsLinked) continue;
      const existsProps = await Transaction.findOne({
        userId: userObj,
        date: { $gte: start, $lt: end },
        type: r.type,
        description: r.description || r.name,
        ...(r.type === "expense"
          ? { category: r.category, subCategoryId: r.subCategoryId || null }
          : { category: "Income" }),
      }).lean();
      if (existsProps) continue;
      const payload = {
        type: r.type,
        amount: Number(r.typicalAmount || 0),
        date: new Date(),
        description: r.description || r.name,
        paymentMethod: r.paymentMethod || "other",
        category: r.category,
        subCategoryId: r.subCategoryId || null,
        notes: "Auto-generated by recurring rule",
      };
      const tx = await createTransaction(userObj, payload);
      created.push(tx);
      await Recurring.updateOne(
        { _id: r._id },
        {
          $set: { lastRunAt: now },
          $push: { linkedTransactionIds: tx._id ? tx._id : undefined },
        },
      );
    } catch (e) {
      errors.push({ id: r._id, message: e?.message || "error" });
    }
  }
  const message =
    created.length > 0
      ? `Created ${created.length} transaction${created.length > 1 ? "s" : ""}`
      : "No due right now. Will auto-run on scheduled date.";
  return { createdCount: created.length, items: created, errors, message };
}
