import SubCategory from "../models/SubCategory.js";

export async function ensureSystemSubcategories() {
  const defs = {
    Needs: [
      "Rent",
      "Utilities",
      "Groceries",
      "Transportation",
      "Insurance",
      "EMIs / Loans",
      "Education",
      "Healthcare",
    ],
    Wants: [
      "Dining Out",
      "Entertainment",
      "Shopping",
      "Travel",
      "Subscriptions",
      "Hobbies",
    ],
    Savings: [
      "Emergency Fund",
      "Retirement",
      "Investments",
      "Vacation Fund",
      "Big Purchase",
      "Education Fund",
    ],
  };
  for (const [category, names] of Object.entries(defs)) {
    for (const name of names) {
      await SubCategory.findOneAndUpdate(
        { userId: null, category, name },
        {
          $setOnInsert: {
            userId: null,
            category,
            name,
            isSystem: true,
            isActive: true,
          },
        },
        { upsert: true, new: true },
      );
    }
  }
}
