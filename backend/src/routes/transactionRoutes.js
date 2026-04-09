import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  createTxCtrl,
  listTxCtrl,
  updateTxCtrl,
  deleteTxCtrl,
  summaryCtrl,
  bulkActionCtrl,
  markReviewedCtrl,
} from "../controllers/transactionController.js";

const router = Router();

router.use(auth);
router.get("/", listTxCtrl);
router.post("/", createTxCtrl);
router.get("/summary", summaryCtrl);
router.put("/:id", updateTxCtrl);
router.delete("/:id", deleteTxCtrl);
router.post("/bulk", bulkActionCtrl);
router.post("/:id/reviewed", markReviewedCtrl);

export default router;
