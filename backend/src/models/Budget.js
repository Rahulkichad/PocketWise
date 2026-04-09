import mongoose from "mongoose";
import { EXPENSE_CATEGORIES } from "../constants/systemCategories.js";

const { Schema } = mongoose;

const BudgetSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    limit: { type: Number, required: true, min: 0 },
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
      index: true,
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
  },
  { timestamps: true },
);

BudgetSchema.index(
  { userId: 1, category: 1, subCategoryId: 1, month: 1, year: 1 },
  { unique: true },
);

export default mongoose.model("Budget", BudgetSchema);
