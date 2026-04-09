import Notification from "../models/Notification.js";

export async function createNotification(userId, message, type = "system") {
  const n = await Notification.create({ user: userId, message, type });
  return n;
}

export async function listNotifications(userId) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 });
}

export async function markRead(userId, id) {
  return Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { read: true },
    { new: true },
  );
}
