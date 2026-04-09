import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listSubCategoriesCtrl,
  createSubCategoryCtrl,
  updateSubCategoryCtrl,
} from "../controllers/subCategoryController.js";

const router = Router();

router.use(auth);
router.get("/", listSubCategoriesCtrl);
router.post("/", createSubCategoryCtrl);
router.put("/:id", updateSubCategoryCtrl);

export default router;
