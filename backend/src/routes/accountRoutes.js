import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listAccountsCtrl,
  createAccountCtrl,
  updateAccountCtrl,
  deleteAccountCtrl,
} from "../controllers/accountController.js";

const router = Router();

router.use(auth);
router.get("/", listAccountsCtrl);
router.post("/", createAccountCtrl);
router.put("/:id", updateAccountCtrl);
router.delete("/:id", deleteAccountCtrl);

export default router;
