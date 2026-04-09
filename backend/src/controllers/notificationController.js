import {
  listNotifications,
  markRead,
} from "../services/notificationService.js";

export async function listNotificationsCtrl(req, res, next) {
  try {
    const notifications = await listNotifications(req.user.id);
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
}

export async function markReadCtrl(req, res, next) {
  try {
    const n = await markRead(req.user.id, req.params.id);
    res.json(n);
  } catch (err) {
    next(err);
  }
}
