import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { biasCtrl } from "../controllers/aiController.js";

const router = Router();

router.use(auth);
router.post("/bias", biasCtrl);

export default router;
