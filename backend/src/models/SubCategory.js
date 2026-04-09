import mongoose from "mongoose";
import { EXPENSE_CATEGORIES } from "../constants/systemCategories.js";

const { Schema } = mongoose;

const SubCategorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    linkedGoalId: { type: Schema.Types.ObjectId, ref: "Goal", default: null },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

SubCategorySchema.index({ userId: 1, category: 1, name: 1 }, { unique: true });

export default mongoose.model("SubCategory", SubCategorySchema);
