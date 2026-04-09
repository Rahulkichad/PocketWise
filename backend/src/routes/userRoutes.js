import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  getProfileCtrl,
  updateProfileCtrl,
} from "../controllers/userController.js";

const router = Router();

router.get("/me/profile", auth, getProfileCtrl);
router.put("/me/profile", auth, updateProfileCtrl);

export default router;
