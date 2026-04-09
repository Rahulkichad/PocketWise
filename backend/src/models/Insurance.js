import mongoose from "mongoose";

const { Schema } = mongoose;

const InsuranceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["life", "health", "accident"],
      required: true,
    },
    coverageAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    annualPremium: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

InsuranceSchema.index({ userId: 1, type: 1 }, { unique: true });

export default mongoose.model("Insurance", InsuranceSchema);
