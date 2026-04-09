import { login, register } from "../services/authService.js";
import User from "../models/User.js";

export async function registerCtrl(req, res, next) {
  try {
    const result = await register(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginCtrl(req, res, next) {
  try {
    const result = await login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function meCtrl(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
