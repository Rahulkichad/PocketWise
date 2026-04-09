import mongoose from "mongoose";

const { Schema } = mongoose;

const TransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["income", "expense", "transfer"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: ["Needs", "Wants", "Savings", "Income", "Transfer"],
      required: true,
    },
    subType: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "other"],
      default: "other",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

TransactionSchema.add({
  subCategoryId: {
    type: Schema.Types.ObjectId,
    ref: "SubCategory",
    default: null,
    index: true,
  },
});

TransactionSchema.pre("validate", async function (next) {
  try {
    if (
      typeof this.amount !== "number" ||
      isNaN(this.amount) ||
      this.amount <= 0
    ) {
      throw new Error("Amount must be a valid positive number");
    }
    if (this.type === "income") {
      this.category = "Income";
    } else if (this.type === "transfer") {
      this.category = "Transfer";
    } else if (this.type === "expense" && !this.category) {
      this.category = "Needs";
    }
    if (!this.category) {
      throw new Error("Category is required");
    }
    const c = this.category;
    if (["Needs", "Wants", "Savings"].includes(c)) {
      if (!this.subCategoryId) {
        throw new Error("subCategoryId is required for Needs/Wants/Savings");
      }
      const SubCategory = mongoose.model("SubCategory");
      const sub = await SubCategory.findById(this.subCategoryId).lean();
      if (!sub || !sub.isActive || sub.category !== c) {
        throw new Error("Invalid subCategoryId mapping for category");
      }
    } else if (["Income", "Transfer"].includes(c)) {
      if (this.subCategoryId) {
        throw new Error("subCategoryId must be null for Income/Transfer");
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Ensure clean number output
TransactionSchema.set("toJSON", {
  transform: function (doc, ret) {
    // Ensure amount is always a number
    ret.amount =
      typeof ret.amount === "number" ? ret.amount : Number(ret.amount || 0);
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Transaction", TransactionSchema);
