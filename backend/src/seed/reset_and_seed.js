import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { ensureSystemSubcategories } from "../config/systemInit.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import Goal from "../models/Goal.js";
import Account from "../models/Account.js";
import Rule from "../models/Rule.js";
import SubCategory from "../models/SubCategory.js";

dotenv.config();

function pick(map, key, fallbackKeys = []) {
  if (map[key]) return map[key];
  for (const k of fallbackKeys) {
    if (map[k]) return map[k];
  }
  const any = Object.values(map)[0];
  return any;
}

async function buildSubMap(category) {
  const rows = await SubCategory.find({
    userId: null,
    category,
    isActive: true,
  }).lean();
  const m = {};
  for (const r of rows) {
    m[r.name] = r._id;
  }
  return m;
}

function randBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function monthDate(base, offsetMonths, day = 15) {
  return new Date(base.getFullYear(), base.getMonth() - offsetMonths, day);
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  // Clear collections
  await Promise.all([
    Transaction.deleteMany({}),
    Budget.deleteMany({}),
    Goal.deleteMany({}),
    Account.deleteMany({}),
    Rule.deleteMany({}),
    // Remove user-defined subcategories; keep system
    SubCategory.deleteMany({ userId: { $ne: null } }),
    User.deleteMany({}), // full reset users
  ]);

  // Ensure system subcategories exist
  await ensureSystemSubcategories();
  try {
    await Budget.collection.dropIndex("userId_1_category_1_month_1_year_1");
  } catch {}
  try {
    await Budget.syncIndexes();
  } catch {}

  // Create the single profile user
  const user = await User.create({
    name: "Rahul",
    email: "rahul@gmail.com",
    password: "Rahul",
    role: "user",
    profile: {
      monthlyIncome: 100000,
      yearlyIncrementPercent: 10,
      age: 26,
      riskProfile: "Aggressive",
      allocations: { needsPct: 40, wantsPct: 20, savingsPct: 40 },
      goals: [],
    },
  });

  // Build subcategory maps
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
    const incomeAmount = i < 12 ? 100000 : Math.round(100000 / 1.1);
    txPayload.push({
      userId: user._id,
      type: "income",
      amount: incomeAmount,
      date: salaryDate,
      description: "Monthly Salary",
    });

    // Optional bonus/freelance a few times over the year
    if (Math.random() < 0.2) {
      txPayload.push({
        userId: user._id,
        type: "income",
        amount: randBetween(10000, 25000),
        date: monthDate(now, i, randBetween(10, 20)),
        description: "Freelance Project",
      });
    }

    // Needs (~40%)
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
      amount: randBetween(4000, 8000),
      date: monthDate(now, i, 20),
      description: "EMI / Loan",
      category: "Needs",
      subCategoryId: pick(needsMap, "EMIs / Loans"),
    });

    // Wants (~20%)
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
        amount: randBetween(6000, 15000),
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

    // Savings (~40% target split: spread across instruments)
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 15000,
      date: monthDate(now, i, 5),
      description: "SIP Investment",
      category: "Savings",
      subCategoryId: pick(savingsMap, "Investments"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 12000,
      date: monthDate(now, i, 8),
      description: "Retirement Contribution",
      category: "Savings",
      subCategoryId: pick(savingsMap, "Retirement"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 10000,
      date: monthDate(now, i, 13),
      description: "Emergency Fund Top-up",
      category: "Savings",
      subCategoryId: pick(savingsMap, "Emergency Fund"),
    });
    txPayload.push({
      userId: user._id,
      type: "expense",
      amount: 3000,
      date: monthDate(now, i, 19),
      description: "ELSS",
      category: "Savings",
      subCategoryId: pick(savingsMap, "Investments"),
    });

    // Budgets per month
    budgetPayload.push(
      { userId: user._id, category: "Needs", limit: 45000, month, year },
      { userId: user._id, category: "Wants", limit: 25000, month, year },
      { userId: user._id, category: "Savings", limit: 40000, month, year },
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
        limit: 10000,
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

  // Two goals to be achieved
  const vacationId = pick(savingsMap, "Vacation Fund");
  const bigPurchaseId = pick(savingsMap, "Big Purchase");
  await Goal.create({
    userId: user._id,
    name: "Foreign Trip",
    targetAmount: 200000,
    linkedSubCategoryId: vacationId,
    targetDate: new Date(now.getFullYear() + 2, now.getMonth(), 1),
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    investmentType: "SIP",
    monthlyContribution: 8000,
  });
  await Goal.create({
    userId: user._id,
    name: "Buying Home",
    targetAmount: 2500000,
    linkedSubCategoryId: bigPurchaseId,
    targetDate: new Date(now.getFullYear() + 7, now.getMonth(), 1),
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    investmentType: "ELSS",
    monthlyContribution: 30000,
  });

  console.log("Database reset and seeded for Rahul (24 months) successfully");
  await mongoose.connection.close();
}

run().catch((e) => {
  console.error("Reset and seed failed:", e);
  process.exit(1);
});
