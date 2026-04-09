import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import {
  listUsersAdminCtrl,
  retrainAdminCtrl,
} from "../controllers/adminController.js";

const router = Router();

router.use(auth, requireRole("admin"));
router.get("/users", listUsersAdminCtrl);
router.post("/retrain", retrainAdminCtrl);

export default router;
