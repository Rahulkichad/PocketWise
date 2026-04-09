import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  summaryCtrl,
  cashflowCtrl,
  categoryBreakdownCtrl,
  trendsCtrl,
  recurringCtrl,
} from "../controllers/analyticsController.js";

const router = Router();

router.use(auth);
router.get("/summary", summaryCtrl);
router.get("/cashflow", cashflowCtrl);
router.get("/category-breakdown", categoryBreakdownCtrl);
router.get("/trends", trendsCtrl);
router.get("/recurring", recurringCtrl);

export default router;
