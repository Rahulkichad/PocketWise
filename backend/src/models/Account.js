import mongoose from "mongoose";

const { Schema } = mongoose;

const AccountSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["bank", "card", "wallet", "cash", "loan", "investment", "other"],
      default: "bank",
    },
    institution: { type: String },
    last4: { type: String },
    currency: { type: String, default: "INR" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

AccountSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model("Account", AccountSchema);
