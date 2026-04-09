import { Router } from "express";
import {
  loginCtrl,
  registerCtrl,
  meCtrl,
} from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.post("/register", registerCtrl);
router.post("/login", loginCtrl);
router.get("/me", auth, meCtrl);

export default router;
