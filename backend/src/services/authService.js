import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

function sign(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export async function register({ name, email, password, role = "user" }) {
  const exists = await User.findOne({ email });
  if (exists) {
    const err = new Error("Email already registered");
    err.status = 400;
    throw err;
  }
  const user = new User({ name, email, password, role });
  await user.save();
  const token = sign(user);
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: user.profile,
    },
  };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }
  const match = await user.matchPassword(password);
  if (!match) {
    const err = new Error("Invalid credentials");
    err.status = 400;
    throw err;
  }
  const token = sign(user);
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: user.profile,
    },
  };
}
