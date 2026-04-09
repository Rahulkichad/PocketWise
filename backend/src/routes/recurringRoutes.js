import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listRecurringCtrl,
  createRecurringCtrl,
  updateRecurringCtrl,
  deleteRecurringCtrl,
  runDueRecurringCtrl,
} from "../controllers/recurringController.js";

const router = Router();

router.use(auth);
router.get("/", listRecurringCtrl);
router.post("/", createRecurringCtrl);
router.put("/:id", updateRecurringCtrl);
router.delete("/:id", deleteRecurringCtrl);
router.post("/run-due", runDueRecurringCtrl);

export default router;
