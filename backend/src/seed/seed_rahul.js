import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import SubCategory from "../models/SubCategory.js";
import { connectDB } from "../config/db.js";
import { ensureSystemSubcategories } from "../config/systemInit.js";

dotenv.config();

function randBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function pick(map, key, fallbacks = []) {
  if (map[key]) return map[key];
  for (const k of fallbacks) {
    if (map[k]) return map[k];
  }
  return Object.values(map)[0];
}

async function buildSubMap(category) {
  const rows = await SubCategory.find({
    userId: null,
    category,
    isActive: true,
  }).lean();
  const m = {};
  for (const r of rows) m[r.name] = r._id;
  return m;
}

function monthDate(base, offsetMonths, day = 15) {
  const d = new Date(base.getFullYear(), base.getMonth() - offsetMonths, day);
  return d;
}

async function run() {
  await connectDB(process.env.MONGO_URI);
  await ensureSystemSubcategories();

  let user = await User.findOne({ email: "rahul@gmail.com" });
  if (!user) {
    user = await User.create({
      name: "Rahul",
      email: "rahul@gmail.com",
      password: "Rahul",
      role: "user",
      profile: {
        monthlyIncome: 100000,
        age: 26,
        riskProfile: "Aggressive",
        goals: [],
      },
    });
  } else {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          "profile.monthlyIncome": 100000,
          "profile.age": 26,
          "profile.riskProfile": "Aggressive",
        },
      },
    );
  }

  const needsMap = await buildSubMap("Needs");
  const wantsMap = await buildSubMap("Wants");
  const savingsMap = await buildSubMap("Savings");

  const now = new Date();

  const txPayload = [];
  const budgetPayload = [];

  for (let i = 0; i < 24; i++) {
    const salaryDate = monthDate(now, i, randBetween(1, 5));
    const mStart = new Date(salaryDate.getFullYear(), salaryDate.getMonth(), 1);
    const month = mStart.getMonth() + 1;
    const year = mStart.getFullYear();

    // Income: monthly salary
    txPayload.push({
      userId: user._id,
      type: "income",
      amount: 100000,
      date: salaryDate,
      description: "Monthly Salary",
    });

    // Optional bonus/freelance 2-3 times over 24 months
    if (Math.random() < 0.15) {
      txPayload.push({
        userId: user._id,
        type: "income",
        amount: randBetween(10000, 25000),
        date: monthDate(now, i, randBetween(10, 20)),
        description: "Freelance Project",
      });
    }

    // Needs (approx 40-45% of income)
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 25000,
      date: monthDate(now, i, 3),
      description: "Monthly Rent",
      category: "Needs",
      subCategoryId: needsMap["Rent"],
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(2500, 3500),
      date: monthDate(now, i, 7),
      description: "Electricity & Utilities",
      category: "Needs",
      subCategoryId: pick(needsMap, "Utilities"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(7000, 9000),
      date: monthDate(now, i, 9),
      description: "Groceries",
      category: "Needs",
      subCategoryId: pick(needsMap, "Groceries"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(2500, 4000),
      date: monthDate(now, i, 12),
      description: "Transportation",
      category: "Needs",
      subCategoryId: pick(needsMap, "Transportation"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(1800, 2600),
      date: monthDate(now, i, 15),
      description: "Mobile/Internet",
      category: "Needs",
      subCategoryId: pick(needsMap, "Utilities"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(1200, 2500),
      date: monthDate(now, i, 18),
      description: "Healthcare",
      category: "Needs",
      subCategoryId: pick(needsMap, "Healthcare"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(8000, 14000),
      date: monthDate(now, i, 20),
      description: "EMI / Loan",
      category: "Needs",
      subCategoryId: pick(needsMap, "EMIs / Loans"),
    });

    // Wants (approx 20-25% of income)
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(2500, 4500),
      date: monthDate(now, i, 6),
      description: "Restaurant Dinner",
      category: "Wants",
      subCategoryId: pick(wantsMap, "Dining Out"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(1200, 2800),
      date: monthDate(now, i, 11),
      description: "Entertainment",
      category: "Wants",
      subCategoryId: pick(wantsMap, "Entertainment"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(2000, 4000),
      date: monthDate(now, i, 16),
      description: "Shopping",
      category: "Wants",
      subCategoryId: pick(wantsMap, "Shopping"),
    });
    if (Math.random() < 0.2) {
      txPayload.push({
        userId: user._id,
        type: "expense",
        amount: randBetween(6000, 18000),
        date: monthDate(now, i, 22),
        description: "Short Trip",
        category: "Wants",
        subCategoryId: pick(wantsMap, "Travel", ["Entertainment"]),
      });
    }
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: randBetween(1500, 2500),
      date: monthDate(now, i, 24),
      description: "Subscriptions",
      category: "Wants",
      subCategoryId: pick(wantsMap, "Subscriptions", ["Hobbies"]),
    });

    // Savings (aggressive profile ~30-35%)
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 12000,
      date: monthDate(now, i, 5),
      description: "SIP Investment",
      category: "Savings",
      subCategoryId: pick(savingsMap, "Investments"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 7000,
      date: monthDate(now, i, 8),
      description: "Retirement Contribution",
      category: "Savings",
      subCategoryId: pick(savingsMap, "Retirement"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 9000,
      date: monthDate(now, i, 13),
      description: "Emergency Fund Top-up",
      category: "Savings",
      subCategoryId: pick(savingsMap, "Emergency Fund"),
    });
    if (Math.random() < 0.25) {
      txPayload.push({
        userId: user._id,
        type: "expense",
        amount: randBetween(4000, 8000),
        date: monthDate(now, i, 19),
        description: "ELSS",
        category: "Savings",
        subCategoryId: pick(savingsMap, "Investments"),
      });
    }

    // Budgets per month (suggested caps)
    budgetPayload.push(
      { userId: user._id, category: "Needs", limit: 45000, month, year },
      { userId: user._id, category: "Wants", limit: 25000, month, year },
      { userId: user._id, category: "Savings", limit: 30000, month, year },
      {
        userId: user._id,
        category: "Needs",
        limit: 9000,
        subCategoryId: pick(needsMap, "Groceries"),
        month,
        year,
      },
      {
        userId: user._id,
        category: "Needs",
        limit: 3500,
        subCategoryId: pick(needsMap, "Utilities"),
        month,
        year,
      },
      {
        userId: user._id,
        category: "Wants",
        limit: 4000,
        subCategoryId: pick(wantsMap, "Dining Out"),
        month,
        year,
      },
      {
        userId: user._id,
        category: "Savings",
        limit: 12000,
        subCategoryId: pick(savingsMap, "Investments"),
        month,
        year,
      },
      {
        userId: user._id,
        category: "Savings",
        limit: 9000,
        subCategoryId: pick(savingsMap, "Emergency Fund"),
        month,
        year,
      },
    );
  }

  // Insert payloads
  if (txPayload.length) {
    await Transaction.insertMany(txPayload);
  }
  if (budgetPayload.length) {
    await Budget.insertMany(budgetPayload);
  }

  console.log(
    `Seeded Rahul with ${txPayload.length} transactions and ${budgetPayload.length} budgets`,
  );
  await mongoose.connection.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
