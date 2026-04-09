import { SYSTEM_CATEGORIES } from "../constants/systemCategories.js";

export async function listCategoriesCtrl(req, res, next) {
  try {
    const items = SYSTEM_CATEGORIES.map((name) => ({
      _id: name,
      name,
      group: name,
      isSystem: true,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
}
