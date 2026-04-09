import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import financeRoutes from "./routes/financeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import goalRoutes from "./routes/goalRoutes.js";
import subCategoryRoutes from "./routes/subCategoryRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import recurringRoutes from "./routes/recurringRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import protectionRoutes from "./routes/protectionRoutes.js";
import { ensureSystemSubcategories } from "./config/systemInit.js";

dotenv.config();

const app = express();

// CORS
const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());
app.use(
  cors({
    origin: origins,
    credentials: true,
  }),
);

app.use(express.json());
app.use(morgan("dev"));

// DB
await connectDB(process.env.MONGO_URI);
await ensureSystemSubcategories();

// Health
app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "backend" }),
);

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/finance", financeRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/budgets", budgetRoutes);
app.use("/api/v1/goals", goalRoutes);
app.use("/api/v1/subcategories", subCategoryRoutes);
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/recurring", recurringRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/protection", protectionRoutes);

// 404
app.use((req, res, next) => {
  res.status(404).json({ message: "Not Found" });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Server Error" });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
