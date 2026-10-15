import { Router } from "express";
import { checkOwnership } from "../../middlewares/auth.middleware.ts";
import { authorize } from "../../middlewares/authorize.middleware.ts";
import { validateProduct } from "../../middlewares/product.middleware.ts";
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

// Every route below requires a valid access token AND the "admin" role.
// checkOwnership verifies/decodes the token and attaches req.user;
// authorize("admin") then checks req.user.role.
productRouter.use(checkOwnership, authorize("admin"));

productRouter.post(
  "/product",
  validateProduct(productValidate),
  createProductController,
);
productRouter.post(
  "/products/images",
  uploadProductImageFile,
  uploadProductImageController,
);
productRouter.get("/listProducts", listProductsAdminController);
productRouter.post(
  "/:id/variants",
  validateProduct(variantValidate),
  addVariantController,
);
productRouter.patch(
  "/:id",
  validateProduct(productUpdateValidate),
  updateProductController,
);
productRouter.delete("/:id", deleteProductController);
productRouter.patch("/:id/restore", restoreProductController);
productRouter.patch(
  "/:id/variants/:variantId/stock",
  adjustVariantStockController,
);

export default productRouter;
