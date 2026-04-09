import {
  summary,
  cashflow,
  categoryBreakdown,
  trends,
  recurring,
} from "../services/analyticsService.js";

export async function summaryCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const data = await summary(userId, req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function cashflowCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const data = await cashflow(userId, req.query);
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
}

export async function categoryBreakdownCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const data = await categoryBreakdown(userId, req.query);
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
}

export async function trendsCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const data = await trends(userId, req.query);
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
}

export async function recurringCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const data = await recurring(userId);
    res.json({ items: data });
  } catch (err) {
    next(err);
  }
}
