import mongoose from "mongoose";

const { Schema } = mongoose;

const RecurringSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    cadence: {
      type: String,
      enum: ["weekly", "monthly", "yearly"],
      required: true,
    },
    nextDueDate: { type: Date },
    typicalAmount: { type: Number, min: 0 },
    type: { type: String, enum: ["income", "expense"], required: true },
    category: {
      type: String,
      enum: ["Needs", "Wants", "Savings", "Income"],
      required: true,
    },
    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "other"],
      default: "other",
    },
    description: { type: String, default: "" },
    dayOfMonth: { type: Number, min: 1, max: 31, default: 1 },
    timeOfDay: { type: String, default: "09:00" }, // HH:mm
    active: { type: Boolean, default: true },
    lastRunAt: { type: Date, default: null },
    linkedTransactionIds: [{ type: Schema.Types.ObjectId, ref: "Transaction" }],
  },
  { timestamps: true },
);

export default mongoose.model("Recurring", RecurringSchema);
