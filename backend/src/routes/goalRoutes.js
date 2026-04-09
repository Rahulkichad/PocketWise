import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listGoalsCtrl,
  createGoalCtrl,
  updateGoalCtrl,
  deleteGoalCtrl,
} from "../controllers/goalController.js";

const router = Router();

router.use(auth);
router.get("/", listGoalsCtrl);
router.post("/", createGoalCtrl);
router.put("/:id", updateGoalCtrl);
router.delete("/:id", deleteGoalCtrl);

export default router;
