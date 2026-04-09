import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import SubCategory from "../models/SubCategory.js";
import User from "../models/User.js";
import Insurance from "../models/Insurance.js";

const { Types } = mongoose;

const NEEDS_MONTHS_WINDOW = 6;
const EMERGENCY_TARGET_MONTHS = 6;
const HEALTH_ADEQUATE_MIN = 1_000_000; // ₹10L
const ACCIDENT_ADEQUATE_MIN = 500_000; // ₹5L
const LIFE_COVERAGE_MIN_MULTIPLIER = 10;
const LIFE_COVERAGE_STRONG_MULTIPLIER = 15;

function dnum(x) {
  if (x == null) return 0;
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

async function getEmergencyFundSubCategoryId() {
  const sub = await SubCategory.findOne({
    userId: null,
    category: "Savings",
    name: "Emergency Fund",
    isActive: true,
  })
    .select("_id")
    .lean();
  return sub?._id || null;
}

/**
 * monthlyExpenses = average Needs spend over last NEEDS_MONTHS_WINDOW calendar months (zeros count).
 * currentEmergencyFund = cumulative expense to Savings > Emergency Fund (transaction-first).
 */
export async function getEmergencyFundSnapshot(userId) {
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const windowStart = new Date(
    now.getFullYear(),
    now.getMonth() - NEEDS_MONTHS_WINDOW,
    1,
  );
  windowStart.setHours(0, 0, 0, 0);

  const needsAgg = await Transaction.aggregate([
    {
      $match: {
        userId: uid,
        type: "expense",
        category: "Needs",
        date: { $gte: windowStart, $lte: now },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const needsTotal = dnum(needsAgg[0]?.total);
  const monthlyExpenses = needsTotal / NEEDS_MONTHS_WINDOW;

  const subId = await getEmergencyFundSubCategoryId();
  let currentEmergencyFund = 0;
  if (subId) {
    const efAgg = await Transaction.aggregate([
      {
        $match: {
          userId: uid,
          type: "expense",
          category: "Savings",
          subCategoryId: subId,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    currentEmergencyFund = dnum(efAgg[0]?.total);
  }

  const targetEmergencyFund = monthlyExpenses > 0
    ? EMERGENCY_TARGET_MONTHS * monthlyExpenses
    : 0;

  const monthsCovered =
    monthlyExpenses > 0 ? currentEmergencyFund / monthlyExpenses : null;

  let status = "setup";
  if (monthlyExpenses > 0 && monthsCovered != null) {
    if (monthsCovered >= 6) status = "safe";
    else if (monthsCovered >= 3) status = "moderate";
    else status = "at_risk";
  }

  return {
    monthlyExpenses,
    targetEmergencyFund,
    currentEmergencyFund,
    monthsCovered,
    status,
    hasNeedsData: needsTotal > 0,
    hasEmergencySubcategory: Boolean(subId),
    windowMonths: NEEDS_MONTHS_WINDOW,
    targetMonths: EMERGENCY_TARGET_MONTHS,
  };
}

function deriveLifeStatus(coverageAmount, annualIncome) {
  const c = dnum(coverageAmount);
  const ai = dnum(annualIncome);
  if (c <= 0) return { status: "missing", label: "Missing" };
  if (ai <= 0) return { status: "unknown", label: "Add income in profile" };
  const minOk = ai * LIFE_COVERAGE_MIN_MULTIPLIER;
  if (c >= minOk) return { status: "adequate", label: "Adequate" };
  return { status: "underinsured", label: "Underinsured" };
}

function deriveHealthStatus(coverageAmount) {
  const c = dnum(coverageAmount);
  if (c <= 0) return { status: "missing", label: "Missing" };
  if (c >= HEALTH_ADEQUATE_MIN) return { status: "adequate", label: "Adequate" };
  return { status: "underinsured", label: "Underinsured" };
}

function deriveAccidentStatus(coverageAmount) {
  const c = dnum(coverageAmount);
  if (c <= 0) return { status: "missing", label: "Missing" };
  if (c >= ACCIDENT_ADEQUATE_MIN) return { status: "adequate", label: "Adequate" };
  return { status: "underinsured", label: "Underinsured" };
}

export async function listInsuranceWithDerived(userId) {
  const user = await User.findById(userId).select("profile.monthlyIncome").lean();
  const monthlyIncome = dnum(user?.profile?.monthlyIncome);
  const annualIncome = monthlyIncome * 12;

  const rows = await Insurance.find({ userId }).lean();
  const byType = Object.fromEntries(
    (rows || []).map((r) => [r.type, r]),
  );

  const types = ["life", "health", "accident"];
  const items = types.map((type) => {
    const row = byType[type];
    if (!row) {
      return {
        type,
        id: null,
        coverageAmount: 0,
        annualPremium: 0,
        provider: "",
        derived: {
          status: "missing",
          label: "Missing",
          lifeTargetMin: annualIncome > 0 ? annualIncome * LIFE_COVERAGE_MIN_MULTIPLIER : null,
          lifeTargetStrong: annualIncome > 0 ? annualIncome * LIFE_COVERAGE_STRONG_MULTIPLIER : null,
          healthBaselineMin: HEALTH_ADEQUATE_MIN,
          accidentBaselineMin: ACCIDENT_ADEQUATE_MIN,
        },
      };
    }
    const cov = dnum(row.coverageAmount);
    let derived;
    if (type === "life") {
      derived = {
        ...deriveLifeStatus(cov, annualIncome),
        lifeTargetMin: annualIncome > 0 ? annualIncome * LIFE_COVERAGE_MIN_MULTIPLIER : null,
        lifeTargetStrong: annualIncome > 0 ? annualIncome * LIFE_COVERAGE_STRONG_MULTIPLIER : null,
      };
    } else if (type === "health") {
      derived = {
        ...deriveHealthStatus(cov),
        healthBaselineMin: HEALTH_ADEQUATE_MIN,
      };
    } else {
      derived = {
        ...deriveAccidentStatus(cov),
        accidentBaselineMin: ACCIDENT_ADEQUATE_MIN,
      };
    }
    return {
      type,
      id: row._id,
      coverageAmount: cov,
      annualPremium: dnum(row.annualPremium),
      provider: row.provider || "",
      derived,
    };
  });

  return {
    items,
    annualIncome,
    lifeBand: {
      minMultiplier: LIFE_COVERAGE_MIN_MULTIPLIER,
      strongMultiplier: LIFE_COVERAGE_STRONG_MULTIPLIER,
    },
  };
}

export async function upsertInsurance(userId, payload) {
  const {
    type,
    coverageAmount,
    annualPremium,
    provider = "",
  } = payload;
  if (!["life", "health", "accident"].includes(type)) {
    const err = new Error("Invalid type");
    err.status = 400;
    throw err;
  }
  const cov = dnum(coverageAmount);
  const prem = dnum(annualPremium);
  if (cov < 0 || prem < 0) {
    const err = new Error("coverageAmount and annualPremium must be non-negative");
    err.status = 400;
    throw err;
  }
  const doc = await Insurance.findOneAndUpdate(
    { userId, type },
    {
      $set: {
        userId,
        type,
        coverageAmount: cov,
        annualPremium: prem,
        provider: String(provider || "").slice(0, 200),
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
  return doc.toJSON();
}

export async function deleteInsurance(userId, type) {
  if (!["life", "health", "accident"].includes(type)) {
    const err = new Error("Invalid type");
    err.status = 400;
    throw err;
  }
  await Insurance.deleteOne({ userId, type });
}
