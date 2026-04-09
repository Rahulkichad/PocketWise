/**
 * Full reset + Rahul Test User with 36 months of transactions, goals, insurance,
 * ML training_data.json export, and validation.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
import Insurance from "../models/Insurance.js";
import {
  TEST_USER,
  buildThreeYearPlan,
  MONTHS_HISTORY,
} from "./seedData.js";
import { runValidation } from "./validate_seed.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function run() {
  await connectDB(process.env.MONGO_URI);

  await Promise.all([
    Transaction.deleteMany({}),
    Budget.deleteMany({}),
    Goal.deleteMany({}),
    Account.deleteMany({}),
    Rule.deleteMany({}),
    Insurance.deleteMany({}),
    SubCategory.deleteMany({ userId: { $ne: null } }),
    User.deleteMany({}),
  ]);

  try {
    await Budget.collection.dropIndex("userId_1_category_1_month_1_year_1");
  } catch {}
  try {
    await Budget.syncIndexes();
  } catch {}

  await ensureSystemSubcategories();

  const user = await User.create({
    name: TEST_USER.name,
    email: TEST_USER.email,
    password: TEST_USER.password,
    role: "user",
    profile: {
      monthlyIncome: TEST_USER.monthlyIncome,
      yearlyIncrementPercent: 10,
      age: TEST_USER.age,
      riskProfile: TEST_USER.riskProfile,
      allocations: TEST_USER.allocations,
      goals: [],
    },
  });

  const needsMap = await buildSubMap("Needs");
  const wantsMap = await buildSubMap("Wants");
  const savingsMap = await buildSubMap("Savings");

  const anchorDate = new Date();
  const { transactions, budgets, trainingRows, monthlyAggregates } =
    buildThreeYearPlan({
      userId: user._id,
      needsMap,
      wantsMap,
      savingsMap,
      anchorDate,
    });

  const last = monthlyAggregates[monthlyAggregates.length - 1];
  const avgIncomeLast12 = monthlyAggregates
    .slice(-12)
    .reduce((s, r) => s + r.income, 0) / Math.min(12, monthlyAggregates.length);

  user.profile.monthlyIncome = Math.round(avgIncomeLast12 || last.income);
  await user.save();

  if (transactions.length) {
    await Transaction.insertMany(transactions);
  }
  if (budgets.length) {
    await Budget.insertMany(budgets);
  }

  const efSub = savingsMap["Emergency Fund"];
  const vacSub = savingsMap["Vacation Fund"];
  const invSub = savingsMap["Investments"];

  const start = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth() - (MONTHS_HISTORY - 1),
    1,
  );

  await Goal.create({
    userId: user._id,
    name: "Emergency Fund",
    targetAmount: 350000,
    linkedSubCategoryId: efSub,
    targetDate: new Date(anchorDate.getFullYear() + 1, anchorDate.getMonth(), 1),
    startDate: start,
    investmentType: "SIP",
    monthlyContribution: 6000,
  });

  await Goal.create({
    userId: user._id,
    name: "Travel Goal",
    targetAmount: 120000,
    linkedSubCategoryId: vacSub,
    targetDate: new Date(anchorDate.getFullYear() + 1, 5, 1),
    startDate: start,
    investmentType: "SIP",
    monthlyContribution: 4000,
  });

  await Goal.create({
    userId: user._id,
    name: "Long-term Wealth",
    targetAmount: 1500000,
    linkedSubCategoryId: invSub,
    targetDate: new Date(anchorDate.getFullYear() + 12, 0, 1),
    startDate: start,
    investmentType: "ELSS",
    monthlyContribution: 12000,
  });

  await Insurance.insertMany([
    {
      userId: user._id,
      type: "life",
      coverageAmount: 9000000,
      annualPremium: 14000,
      provider: "Test Life Co.",
    },
    {
      userId: user._id,
      type: "health",
      coverageAmount: 1000000,
      annualPremium: 11000,
      provider: "Test Health Co.",
    },
    {
      userId: user._id,
      type: "accident",
      coverageAmount: 600000,
      annualPremium: 1800,
      provider: "Test Accident Co.",
    },
  ]);

  const mlDir = path.join(__dirname, "../../../ml/datasets");
  fs.mkdirSync(mlDir, { recursive: true });
  const trainingPath = path.join(mlDir, "training_data.json");
  const trainingPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "derived_from_seed_transactions",
      userEmail: TEST_USER.email,
      months: MONTHS_HISTORY,
      labelDerivation:
        "equity/debt/tax bias labels computed from monthly savings sub-flows (Investments, Retirement, Vacation, Emergency Fund)",
    },
    rows: trainingRows,
  };
  fs.writeFileSync(trainingPath, JSON.stringify(trainingPayload, null, 2), "utf8");
  console.log(`Wrote ${trainingRows.length} training rows → ${trainingPath}`);

  const validation = await runValidation(user._id);
  const reportPath = path.join(__dirname, "VALIDATION_REPORT.md");
  fs.writeFileSync(reportPath, validation.markdown, "utf8");
  console.log(validation.markdown);
  console.log(`\nValidation report → ${reportPath}`);

  console.log(
    `\nSeed OK — ${TEST_USER.email} / ${TEST_USER.password} — ${transactions.length} transactions, ${MONTHS_HISTORY} months.`,
  );

  await mongoose.connection.close();
}

run().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
