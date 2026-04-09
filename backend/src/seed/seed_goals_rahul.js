import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Goal from "../models/Goal.js";
import SubCategory from "../models/SubCategory.js";
import Transaction from "../models/Transaction.js";
import { connectDB } from "../config/db.js";
import { ensureSystemSubcategories } from "../config/systemInit.js";

dotenv.config();

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

async function upsertGoal(
  userId,
  {
    name,
    targetAmount,
    linkedSubCategoryId,
    targetDate,
    startDate,
    investmentType,
    monthlyContribution,
  },
) {
  const existing = await Goal.findOne({ userId, name }).lean();
  if (existing) {
    await Goal.updateOne(
      { _id: existing._id },
      {
        $set: {
          targetAmount,
          linkedSubCategoryId,
          targetDate,
          startDate,
          investmentType,
          monthlyContribution,
        },
      },
    );
    return existing._id;
  } else {
    const doc = await Goal.create({
      userId,
      name,
      targetAmount,
      linkedSubCategoryId,
      targetDate,
      startDate,
      investmentType,
      monthlyContribution,
    });
    return doc._id;
  }
}

async function upsertContribution(
  userId,
  date,
  amount,
  subCategoryId,
  description,
) {
  const exists = await Transaction.findOne({
    userId,
    date,
    amount,
    description,
    category: "Savings",
    subCategoryId,
  }).lean();
  if (!exists) {
    await Transaction.create({
      userId,
      type: "expense",
      category: "Savings",
      subCategoryId,
      date,
      amount,
      description,
    });
  }
}

async function run() {
  await connectDB(process.env.MONGO_URI);
  await ensureSystemSubcategories();

  const user = await User.findOne({ email: "rahul@gmail.com" }).lean();
  if (!user) {
    console.error("User rahul@gmail.com not found. Seed user first.");
    process.exit(1);
  }

  const savingsMap = await buildSubMap("Savings");
  const vacationId = savingsMap["Vacation Fund"];
  const bigPurchaseId = savingsMap["Big Purchase"];
  if (!vacationId || !bigPurchaseId) {
    console.error("Required Savings subcategories not found");
    process.exit(1);
  }

  const now = new Date();
  const foreignTripTarget = 200000; // ₹2,00,000
  const foreignTripMonthly = 8000;
  const homeTarget = 2500000; // ₹25,00,000
  const homeMonthly = 30000;

  // Foreign Trip in 2 years
  const ftGoalId = await upsertGoal(user._id, {
    name: "Foreign Trip",
    targetAmount: foreignTripTarget,
    linkedSubCategoryId: vacationId,
    targetDate: new Date(now.getFullYear() + 2, now.getMonth(), 1),
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    investmentType: "SIP",
    monthlyContribution: foreignTripMonthly,
  });

  // Buying Home in 7 years
  const homeGoalId = await upsertGoal(user._id, {
    name: "Buying Home",
    targetAmount: homeTarget,
    linkedSubCategoryId: bigPurchaseId,
    targetDate: new Date(now.getFullYear() + 7, now.getMonth(), 1),
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    investmentType: "ELSS",
    monthlyContribution: homeMonthly,
  });

  // Backfill last 6 months contributions to show progress
  for (let i = 0; i < 6; i++) {
    const d1 = monthDate(now, i, 10);
    const d2 = monthDate(now, i, 12);
    await upsertContribution(
      user._id,
      d1,
      foreignTripMonthly,
      vacationId,
      "Foreign Trip Contribution",
    );
    await upsertContribution(
      user._id,
      d2,
      homeMonthly,
      bigPurchaseId,
      "Home Purchase SIP",
    );
  }

  console.log("Seeded goals for Rahul:", {
    foreignTripGoalId: ftGoalId.toString(),
    homeGoalId: homeGoalId.toString(),
  });
  await mongoose.connection.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
