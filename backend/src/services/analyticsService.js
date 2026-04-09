import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";

const { Types } = mongoose;

function dnumber(x) {
  if (x == null) return 0;
  if (typeof x === "number") return isNaN(x) ? 0 : x;
  if (typeof x === "string") return parseFloat(x) || 0;
  return Number(x) || 0;
}

/** Calendar months spanned by [start, end] (inclusive), minimum 1 */
function monthsInPeriod(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(
    1,
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1,
  );
}

function rangeToDates(range, offset = 0, query = {}) {
  const q = query || {};
  const cy = q.calendarYear != null ? parseInt(String(q.calendarYear), 10) : NaN;
  const cm = q.calendarMonth != null ? parseInt(String(q.calendarMonth), 10) : NaN;

  if (Number.isFinite(cy) && Number.isFinite(cm) && cm >= 1 && cm <= 12) {
    const start = new Date(cy, cm - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(cy, cm, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const r = (range || "month").toLowerCase();
  if (r === "calyear" && Number.isFinite(cy)) {
    const start = new Date(cy, 0, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(cy, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  const now = new Date();
  if (r === "all") return { start: new Date(0), end: now };
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  let months = 1;
  if (r === "3m") months = 3;
  else if (r === "6m") months = 6;
  else if (r === "12m" || r === "year") months = 12;
  const start = new Date(monthStart);
  start.setMonth(start.getMonth() - (months - 1 + months * Number(offset || 0)), 1);
  start.setHours(0, 0, 0, 0);
  if (Number(offset || 0) === 0) {
    return { start, end: now };
  }
  const endMonthStart = new Date(monthStart);
  endMonthStart.setMonth(endMonthStart.getMonth() - months * Number(offset || 0), 1);
  const nextMonthStart = new Date(endMonthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1, 1);
  const end = new Date(nextMonthStart.getTime() - 1);
  return { start, end };
}

/** For summary / category-breakdown: all-time starts at first transaction, not epoch */
async function getAnalyticsBounds(userId, query = {}) {
  const range = String(query.range || "month").toLowerCase();
  if (range === "all") {
    const uid = new Types.ObjectId(userId);
    const first = await Transaction.findOne({ userId: uid }).sort({ date: 1 }).lean();
    const now = new Date();
    const start = first?.date ? new Date(first.date) : now;
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  return rangeToDates(query.range || "month", Number(query.offset) || 0, query);
}

export async function summary(userId, query = {}) {
  const range = query.range || "month";
  const { start, end } = await getAnalyticsBounds(userId, query);
  const match = {
    userId: new Types.ObjectId(userId),
    date: { $gte: start, $lte: end },
  };

  const pipeline = [
    { $match: match },
    { $match: { type: { $in: ["income", "expense"] } } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ];

  const rows = await Transaction.aggregate(pipeline);
  let income = 0,
    expense = 0;

  for (const r of rows) {
    const val = dnumber(r.total);
    if (r._id === "income") income = val;
    if (r._id === "expense") expense = val;
  }

  const savings = income - expense;
  const investable = Math.max(0, savings * 0.5); // 50% of savings is investable
  const mip = monthsInPeriod(start, end);

  return {
    range,
    income: dnumber(income),
    expense: dnumber(expense),
    savings: dnumber(savings),
    cashflow: dnumber(savings),
    investable: dnumber(investable),
    monthsInPeriod: mip,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

export async function cashflow(userId, { range = "6m", offset = 0 } = {}) {
  const { start, end } = rangeToDates(range, offset, {});
  const match = {
    userId: new Types.ObjectId(userId),
    date: { $gte: start, $lte: end },
    type: { $in: ["income", "expense"] },
  };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          y: { $year: "$date" },
          m: { $month: "$date" },
          type: "$type",
        },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
  ];

  const rows = await Transaction.aggregate(pipeline);
  const map = {};

  for (const r of rows) {
    const key = `${r._id.y}-${String(r._id.m).padStart(2, "0")}`;
    if (!map[key]) map[key] = { period: key, income: 0, expense: 0 };
    const val = dnumber(r.total);
    map[key][r._id.type] = val;
  }

  return Object.values(map).map((x) => ({
    period: x.period,
    income: dnumber(x.income),
    expense: dnumber(x.expense),
    savings: dnumber(x.income - x.expense),
  }));
}

export async function categoryBreakdown(userId, query = {}) {
  const { start, end } = await getAnalyticsBounds(userId, query);
  const match = {
    userId: new Types.ObjectId(userId),
    date: { $gte: start, $lte: end },
    type: "expense",
  };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$amount" },
      },
    },
    { $sort: { total: -1 } },
  ];

  const rows = await Transaction.aggregate(pipeline);
  return rows.map((r) => ({
    categoryId: null,
    name: r._id || "Uncategorized",
    group: r._id || "Needs",
    total: dnumber(r.total),
  }));
}

export async function trends(userId, { range = "12m", offset = 0 } = {}) {
  const { start, end } = rangeToDates(range, offset, {});
  const match = {
    userId: new Types.ObjectId(userId),
    date: { $gte: start, $lte: end },
    type: "expense",
  };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          y: { $year: "$date" },
          m: { $month: "$date" },
          group: "$category",
        },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1 } },
  ];

  const rows = await Transaction.aggregate(pipeline);
  return rows.map((r) => ({
    period: `${r._id.y}-${String(r._id.m).padStart(2, "0")}`,
    group: r._id.group || "Needs",
    total: dnumber(r.total),
  }));
}

export async function recurring(userId) {
  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;
  const items = await Transaction.find({
    userId: userIdObj,
    type: { $in: ["income", "expense"] },
  })
    .sort({ date: -1 })
    .limit(200);

  return items.map((i) => {
    const j = i.toJSON();
    j.amount = dnumber(j.amount);
    return j;
  });
}

export async function legacyMonthlyGroupExpense(userId) {
  // Convert userId to ObjectId if it's a string
  const userIdObj = Types.ObjectId.isValid(userId)
    ? new Types.ObjectId(userId)
    : userId;

  const pipeline = [
    {
      $match: {
        userId: userIdObj,
        type: "expense",
        date: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    },
    {
      $group: {
        _id: "$category",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { total: -1 },
    },
  ];

  const results = await Transaction.aggregate(pipeline);
  return results.map((item) => ({
    category: item._id,
    total: dnumber(item.total),
    count: item.count,
  }));
}
