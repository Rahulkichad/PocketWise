import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listBudgetsCtrl,
  upsertBudgetCtrl,
} from "../controllers/budgetController.js";

const router = Router();

router.use(auth);
router.get("/", listBudgetsCtrl);
router.post("/", upsertBudgetCtrl);

export default router;
