import mongoose from "mongoose";

const { Schema } = mongoose;

const GoalSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true, min: 0 },
    linkedSubCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
      required: true,
      index: true,
    },
    targetDate: { type: Date },
    startDate: { type: Date },
    investmentType: { type: String, enum: ["SIP", "PPF", "NPS", "ELSS"] },
    monthlyContribution: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

GoalSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model("Goal", GoalSchema);
