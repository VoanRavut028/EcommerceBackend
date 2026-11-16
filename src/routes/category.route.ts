import { Router } from "express";
import {
  createCategoryController,
  deleteCategoryController,
  getCategoriesController,
  getCategoryController,
  restoreCategoryController,
  updateCategoryController,
} from "../controllers/category.controller.ts";
import { checkOwnership } from "../middlewares/auth.middleware.ts";
import { authorize } from "../middlewares/authorize.middleware.ts";
import { validateBody } from "../middlewares/validate.middleware.ts";
import {
  createCategoryValidate,
  updateCategoryValidate,
} from "../utils/categoryValidator.ts";

const categoryRouter = Router();

// Authenticate only category endpoints so unrelated public routes can pass
// through this router without requiring an admin token.
const adminOnly = [checkOwnership, authorize("admin")] as const;

categoryRouter.post(
  "/categories",
  ...adminOnly,
  validateBody(createCategoryValidate),
  createCategoryController,
);
categoryRouter.get("/categories", getCategoriesController);
categoryRouter.get("/categories/:slug", getCategoryController);
categoryRouter.patch(
  "/categories/:id",
  ...adminOnly,
  validateBody(updateCategoryValidate),
  updateCategoryController,
);
categoryRouter.patch(
  "/categories/:id/restore",
  ...adminOnly,
  restoreCategoryController,
);
categoryRouter.delete("/categories/:id", ...adminOnly, deleteCategoryController);

export default categoryRouter;
