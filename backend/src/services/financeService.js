import axios from "axios";
import mongoose from "mongoose";
import User from "../models/User.js";
import Goal from "../models/Goal.js";
import Transaction from "../models/Transaction.js";

export function smartSalarySplit(monthlyIncome) {
  if (monthlyIncome <= 30000) return { Needs: 0.6, Wants: 0.25, Savings: 0.15 };
  if (monthlyIncome <= 70000) return { Needs: 0.5, Wants: 0.3, Savings: 0.2 };
  return { Needs: 0.4, Wants: 0.3, Savings: 0.3 };
}

export async function recommendPortfolio(userId) {
  const user = await User.findById(userId);
  
  // Fetch goals from collection and calculate progress for accurate AI recommendations
  const goalsRaw = await Goal.find({ userId }).lean();
  const subIds = goalsRaw.map(g => g.linkedSubCategoryId).filter(Boolean);
  
  const rows = await Transaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: "expense",
        category: "Savings",
        subCategoryId: { $in: subIds },
      },
    },
    { $group: { _id: "$subCategoryId", total: { $sum: "$amount" } } },
  ]);
  const progMap = Object.fromEntries(
    rows.map((r) => [String(r._id), Number(r.total || 0)]),
  );

  const goals = goalsRaw.map(g => ({
    name: g.name,
    targetAmount: g.targetAmount,
    targetDate: g.targetDate,
    monthlyRequired: g.monthlyContribution || 0,
    progress: progMap[String(g.linkedSubCategoryId)] || 0
  }));

  const payload = {
    monthlyIncome: user?.profile?.monthlyIncome || 0,
    age: user?.profile?.age || 0,
    riskProfile: user?.profile?.riskProfile || "Moderate",
    goals
  };
  const url = `${process.env.ML_SERVICE_URL || "http://localhost:8001"}/recommend`;
  const { data } = await axios.post(url, payload, { timeout: 10000 });
  // Backward-compatible fields for existing frontend
  // Prefer user's custom allocations if present
  const userAlloc = user?.profile?.allocations;
  if (
    userAlloc &&
    typeof userAlloc.needsPct === "number" &&
    typeof userAlloc.wantsPct === "number" &&
    typeof userAlloc.savingsPct === "number"
  ) {
    data.recommendedSplit = {
      needsPct: userAlloc.needsPct,
      wantsPct: userAlloc.wantsPct,
      savingsPct: userAlloc.savingsPct,
    };
  }
  // Derive monthly investable from user's savings allocation if income present
  const income = Number(user?.profile?.monthlyIncome || 0);
  if (
    !isNaN(income) &&
    income > 0 &&
    data.recommendedSplit?.savingsPct != null
  ) {
    data.investableMonthly = Number(
      (income * (Number(data.recommendedSplit.savingsPct) / 100)).toFixed(2),
    );
  }
  const split = data.recommendedSplit
    ? {
        Needs: data.recommendedSplit.needsPct,
        Wants: data.recommendedSplit.wantsPct,
        Savings: data.recommendedSplit.savingsPct,
      }
    : undefined;
  const allocations = Array.isArray(data.instruments)
    ? data.instruments.reduce((acc, it) => {
        acc[it.type] = it.monthlyAmount;
        return acc;
      }, {})
    : undefined;
  return {
    ...data,
    ...(split ? { split } : {}),
    ...(allocations ? { allocations } : {}),
  };
}

export function estimateTaxSavings(
  annualIncome,
  investedUnder80C = 0,
  investedUnder80D = 0,
  age = 30,
  investedUnder80CCD1B = 0,
) {
  const cap80C = 150000; // 80C combined cap
  const cap80D = age >= 60 ? 50000 : 25000; // 80D cap varies by senior status
  const eligible80C = Math.min(investedUnder80C, cap80C);
  const eligible80D = Math.min(investedUnder80D, cap80D);
  const cap80CCD1B = 50000; // Additional NPS deduction
  const eligible80CCD1B = Math.min(investedUnder80CCD1B, cap80CCD1B);
  const slab =
    annualIncome <= 500000 ? 0.05 : annualIncome <= 1000000 ? 0.2 : 0.3;
  const base = (eligible80C + eligible80D + eligible80CCD1B) * slab;
  return Number((base * 1.04).toFixed(2));
}

export function projectWealth({
  monthlyContribution,
  annualRate = 0.1,
  months = 12,
  inflation = 0.06,
}) {
  const realRate = (1 + annualRate) / (1 + inflation) - 1;
  const r = realRate / 12;
  const points = [];
  let value = 0;
  for (let i = 1; i <= months; i++) {
    value = (value + monthlyContribution) * (1 + r);
    points.push({ month: i, value: Number(value.toFixed(2)) });
  }
  return points;
}

export async function retrainModel() {
  const url = `${process.env.ML_SERVICE_URL || "http://localhost:8001"}/retrain`;
  const { data } = await axios.post(url, {});
  return data;
}
