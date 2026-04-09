import User from "../models/User.js";
import Budget from "../models/Budget.js";

export async function getProfileCtrl(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({
      profile: user.profile,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfileCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const update = {};
    const numOr = (v, def = 0) =>
      typeof v === "number" ? v : Number(v ?? def);

    const currentUser = await User.findById(userId).lean();
    if (!currentUser) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    let income = currentUser.profile.monthlyIncome || 0;
    if (req.body.monthlyIncome !== undefined) {
      const val = numOr(req.body.monthlyIncome, 0);
      if (isNaN(val) || val < 0) {
        const err = new Error("monthlyIncome must be a non-negative number");
        err.status = 400;
        throw err;
      }
      update["profile.monthlyIncome"] = val;
      income = val;
    }

    if (req.body.yearlyIncrementPercent !== undefined) {
      const val = numOr(req.body.yearlyIncrementPercent, 0);
      if (isNaN(val) || val < 0 || val > 100) {
        const err = new Error(
          "yearlyIncrementPercent must be between 0 and 100",
        );
        err.status = 400;
        throw err;
      }
      update["profile.yearlyIncrementPercent"] = val;
    }

    if (req.body.age !== undefined) {
      const val = numOr(req.body.age, 0);
      if (isNaN(val) || val < 0 || val > 120) {
        const err = new Error("age must be a valid number between 0 and 120");
        err.status = 400;
        throw err;
      }
      update["profile.age"] = val;
    }

    if (req.body.riskProfile)
      update["profile.riskProfile"] = req.body.riskProfile;

    let allocationsChanged = false;
    let needsPct = currentUser.profile.allocations?.needsPct || 50;
    let wantsPct = currentUser.profile.allocations?.wantsPct || 30;
    let savingsPct = currentUser.profile.allocations?.savingsPct || 20;

    if (req.body.allocations) {
      const a = req.body.allocations || {};
      needsPct = numOr(a.needsPct, 0);
      wantsPct = numOr(a.wantsPct, 0);
      savingsPct = numOr(a.savingsPct, 0);
      if ([needsPct, wantsPct, savingsPct].some((v) => isNaN(v) || v < 0 || v > 100)) {
        const err = new Error(
          "Allocation percentages must be numbers between 0 and 100",
        );
        err.status = 400;
        throw err;
      }
      const total = Number((needsPct + wantsPct + savingsPct).toFixed(2));
      if (Math.round(total) !== 100) {
        const err = new Error("Allocation percentages must sum to 100");
        err.status = 400;
        throw err;
      }
      update["profile.allocations"] = {
        needsPct,
        wantsPct,
        savingsPct,
      };
      allocationsChanged = true;
    }

    if (req.body.goals) update["profile.goals"] = req.body.goals;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true },
    ).select("-password");

    // Sync budgets if allocations or income changed
    if (allocationsChanged || req.body.monthlyIncome !== undefined) {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      const budgetsToSync = [
        { category: "Needs", limit: Math.round(income * (needsPct / 100)) },
        { category: "Wants", limit: Math.round(income * (wantsPct / 100)) },
        { category: "Savings", limit: Math.round(income * (savingsPct / 100)) },
      ];

      for (const b of budgetsToSync) {
        await Budget.findOneAndUpdate(
          { userId, category: b.category, month, year, subCategoryId: null },
          { $set: { limit: b.limit } },
          { upsert: true }
        );
      }
    }

    res.json({ profile: user.profile });
  } catch (err) {
    next(err);
  }
}

export async function listUsersCtrl(req, res, next) {
  try {
    const users = await User.find().select("-password");
    res.json({ users });
  } catch (err) {
    next(err);
  }
}
