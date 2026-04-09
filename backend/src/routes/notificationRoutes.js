import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listNotificationsCtrl,
  markReadCtrl,
} from "../controllers/notificationController.js";

const router = Router();

router.use(auth);
router.get("/", listNotificationsCtrl);
router.post("/:id/read", markReadCtrl);

export default router;
