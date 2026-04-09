import {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  runDueRecurring,
} from "../services/recurringService.js";

export async function listRecurringCtrl(req, res, next) {
  try {
    const items = await listRecurring(req.user.id);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function createRecurringCtrl(req, res, next) {
  try {
    const doc = await createRecurring(req.user.id, req.body);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateRecurringCtrl(req, res, next) {
  try {
    const doc = await updateRecurring(req.user.id, req.params.id, req.body);
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function deleteRecurringCtrl(req, res, next) {
  try {
    await deleteRecurring(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function runDueRecurringCtrl(req, res, next) {
  try {
    const result = await runDueRecurring(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
