import {
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  bulkAction,
  markReviewed,
} from "../services/transactionService.js";
import { legacyMonthlyGroupExpense } from "../services/analyticsService.js";

export async function createTxCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const tx = await createTransaction(userId, req.body);
    res.status(201).json(tx);
  } catch (err) {
    console.error("Create transaction error:", err);
    next(err);
  }
}

export async function listTxCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const txs = await getTransactions(userId, req.query);
    res.json(txs);
  } catch (err) {
    next(err);
  }
}

export async function updateTxCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const tx = await updateTransaction(userId, req.params.id, req.body);
    res.json(tx);
  } catch (err) {
    next(err);
  }
}

export async function deleteTxCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    await deleteTransaction(userId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function summaryCtrl(req, res, next) {
  try {
    // This endpoint is deprecated, use /analytics/summary instead
    res.json({ message: "Use /analytics/summary endpoint" });
  } catch (err) {
    next(err);
  }
}

export async function bulkActionCtrl(req, res, next) {
  try {
    res.json({ message: "Bulk actions not implemented" });
  } catch (err) {
    next(err);
  }
}

export async function markReviewedCtrl(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const tx = await markReviewed(userId, req.params.id);
    res.json(tx);
  } catch (err) {
    next(err);
  }
}
