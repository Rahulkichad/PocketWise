import Account from "../models/Account.js";

export async function listAccountsCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const items = await Account.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function createAccountCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      name,
      type = "bank",
      institution = "",
      last4 = "",
      currency = "INR",
    } = req.body || {};
    if (!name) {
      const err = new Error("name is required");
      err.status = 400;
      throw err;
    }
    const acc = await Account.create({
      user: userId,
      name,
      type,
      institution,
      last4: String(last4 || "").slice(0, 4),
      currency,
    });
    res.status(201).json(acc.toJSON());
  } catch (err) {
    if (err.code === 11000) {
      err.status = 400;
      err.message = "Account name already exists";
    }
    next(err);
  }
}

export async function updateAccountCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    const update = {};
    const allowed = [
      "name",
      "type",
      "institution",
      "last4",
      "currency",
      "isActive",
    ];
    for (const k of allowed) {
      if (req.body[k] !== undefined)
        update[k] =
          k === "last4" ? String(req.body[k] || "").slice(0, 4) : req.body[k];
    }
    const acc = await Account.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: update },
      { new: true },
    ).lean();
    if (!acc) {
      const err = new Error("Account not found");
      err.status = 404;
      throw err;
    }
    res.json(acc);
  } catch (err) {
    next(err);
  }
}

export async function deleteAccountCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const id = req.params.id;
    const result = await Account.deleteOne({ _id: id, user: userId });
    if (result.deletedCount === 0) {
      const err = new Error("Account not found");
      err.status = 404;
      throw err;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
