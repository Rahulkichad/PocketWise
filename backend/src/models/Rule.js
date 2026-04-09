import mongoose from "mongoose";

const { Schema } = mongoose;

const RuleSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    if: {
      merchantContains: { type: String },
      descriptionContains: { type: String },
      amountMin: { type: Schema.Types.Decimal128 },
      amountMax: { type: Schema.Types.Decimal128 },
      categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
      accountId: { type: Schema.Types.ObjectId, ref: "Account" },
    },
    then: {
      setCategoryId: { type: Schema.Types.ObjectId, ref: "Category" },
      addTags: [{ type: String }],
      markReviewed: { type: Boolean },
      setRecurring: { type: Boolean },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Rule", RuleSchema);
