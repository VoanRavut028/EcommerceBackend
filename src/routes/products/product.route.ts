import { Router } from "express";
import { checkOwnership } from "../../middlewares/auth.middleware.ts";
import { authorize } from "../../middlewares/authorize.middleware.ts";
import { validateBody } from "../../middlewares/validate.middleware.ts";
import { uploadProductImageFile } from "../../middlewares/upload.middleware.ts";
import {
  variantValidate,
  productUpdateValidate,
  productValidate,
} from "../../utils/productValidator.ts";
import {
  addVariantController,
  createProductController,
  updateProductController,
  deleteProductController,
  restoreProductController,
  listProductsAdminController,
  adjustVariantStockController,
} from "../../controllers/products/product.controller.ts";
import { uploadProductImageController } from "../../controllers/upload/upload.controller.ts";

const productRouter = Router();

const adminOnly = [checkOwnership, authorize("admin")] as const;

productRouter.post(
  "/product",
  ...adminOnly,
  validateBody(productValidate),
  createProductController,
);
productRouter.post(
  "/products/images",
  ...adminOnly,
  uploadProductImageFile,
  uploadProductImageController,
);
productRouter.get("/listProducts", ...adminOnly, listProductsAdminController);
productRouter.post(
  "/:id/variants",
  ...adminOnly,
  validateBody(variantValidate),
  addVariantController,
);
productRouter.patch(
  "/:id",
  ...adminOnly,
  validateBody(productUpdateValidate),
  updateProductController,
);
productRouter.delete("/:id", ...adminOnly, deleteProductController);
productRouter.patch("/:id/restore", ...adminOnly, restoreProductController);
productRouter.patch(
  "/:id/variants/:variantId/stock",
  ...adminOnly,
  adjustVariantStockController,
);

export default productRouter;
