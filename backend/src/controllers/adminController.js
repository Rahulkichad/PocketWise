import User from "../models/User.js";
import { retrainModel } from "../services/financeService.js";

export async function listUsersAdminCtrl(req, res, next) {
  try {
    const users = await User.find().select("-password");
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function retrainAdminCtrl(req, res, next) {
  try {
    const r = await retrainModel();
    res.json(r);
  } catch (err) {
    next(err);
  }
}
