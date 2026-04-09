import {
  smartSalarySplit,
  recommendPortfolio,
  estimateTaxSavings,
  projectWealth,
  retrainModel,
} from "../services/financeService.js";
import { createNotification } from "../services/notificationService.js";
import User from "../models/User.js";

export async function splitCtrl(req, res, next) {
  try {
    const income = Number(req.body.monthlyIncome);
    const split = smartSalarySplit(income);
    res.json({ income, split });
  } catch (err) {
    next(err);
  }
}

export async function recommendCtrl(req, res, next) {
  try {
    const reco = await recommendPortfolio(req.user.id);
    res.json(reco);
  } catch (err) {
    next(err);
  }
}

export async function projectionCtrl(req, res, next) {
  try {
    const { monthlyContribution, annualRate, months, inflation } = req.body;
    const series = projectWealth({
      monthlyContribution,
      annualRate,
      months,
      inflation,
    });
    res.json({ series });
  } catch (err) {
    next(err);
  }
}

export async function taxCtrl(req, res, next) {
  try {
    const {
      annualIncome,
      investedUnder80C,
      investedUnder80D,
      age,
      investedUnder80CCD1B,
    } = req.body;
    const taxSave = estimateTaxSavings(
      annualIncome,
      investedUnder80C,
      investedUnder80D,
      age,
      investedUnder80CCD1B,
    );
    res.json({ taxSave });
  } catch (err) {
    next(err);
  }
}

export async function notifyMonthlyCtrl(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    const msg = `Monthly recommendations are ready for ${user.name}`;
    const n = await createNotification(req.user.id, msg, "monthly_reco");
    res.json(n);
  } catch (err) {
    next(err);
  }
}

export async function retrainCtrl(req, res, next) {
  try {
    const r = await retrainModel();
    res.json(r);
  } catch (err) {
    next(err);
  }
}
