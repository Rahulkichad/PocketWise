import { Router } from "express";
import axios from "axios";
import { auth } from "../middleware/auth.js";

const router = Router();

// Chat requires auth
router.post("/", auth, async (req, res, next) => {
  try {
    const mlUrl = process.env.ML_SERVICE_URL || "http://localhost:8001";
    const payload = { userId: req.user?.id, message: req.body?.message };
    if (!payload.message || typeof payload.message !== "string") {
      return res.status(400).json({ message: "message is required" });
    }
    const { data } = await axios.post(`${mlUrl}/chat`, payload, {
      timeout: 8000,
    });
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// Health should be public (no auth) so UI can always show status
router.get("/health", async (req, res, next) => {
  try {
    const mlUrl = process.env.ML_SERVICE_URL || "http://localhost:8001";
    const { data } = await axios.get(`${mlUrl}/health`, { timeout: 4000 });
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
