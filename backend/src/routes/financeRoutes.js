import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import {
  splitCtrl,
  recommendCtrl,
  projectionCtrl,
  taxCtrl,
  notifyMonthlyCtrl,
  retrainCtrl,
} from "../controllers/financeController.js";

const router = Router();

router.post("/split", auth, splitCtrl);
router.post("/recommend", auth, recommendCtrl);
router.post("/projection", auth, projectionCtrl);
router.post("/tax", auth, taxCtrl);
router.post("/notify-monthly", auth, notifyMonthlyCtrl);

router.post("/retrain", auth, requireRole("admin"), retrainCtrl);

export default router;
