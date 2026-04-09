import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const GoalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    targetDate: { type: Date, required: true },
    progress: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profile: {
      monthlyIncome: { type: Number, default: 0 },
      yearlyIncrementPercent: { type: Number, default: 0, min: 0, max: 100 },
      age: { type: Number, default: 0 },
      riskProfile: {
        type: String,
        enum: ["Conservative", "Moderate", "Aggressive"],
        default: "Moderate",
      },
      allocations: {
        needsPct: { type: Number, default: 50, min: 0, max: 100 },
        wantsPct: { type: Number, default: 30, min: 0, max: 100 },
        savingsPct: { type: Number, default: 20, min: 0, max: 100 },
      },
      goals: [GoalSchema],
    },
  },
  { timestamps: true },
);

UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export default mongoose.model("User", UserSchema);
