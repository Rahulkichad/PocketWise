import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  emergencyFundCtrl,
  listInsuranceCtrl,
  upsertInsuranceCtrl,
  deleteInsuranceCtrl,
} from "../controllers/protectionController.js";

const router = Router();

router.use(auth);
router.get("/emergency-fund", emergencyFundCtrl);
router.get("/insurance", listInsuranceCtrl);
router.put("/insurance", upsertInsuranceCtrl);
router.delete("/insurance/:type", deleteInsuranceCtrl);

export default router;
