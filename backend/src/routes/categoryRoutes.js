import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { listCategoriesCtrl } from "../controllers/categoryController.js";

const router = Router();

router.use(auth);
router.get("/", listCategoriesCtrl);

export default router;
