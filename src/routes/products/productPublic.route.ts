import { Router } from "express";
import {
  listProductsPublicController,
  getProductBySlugController,
} from "../../controllers/products/product.controller.ts";

const publicProductRouter = Router();

publicProductRouter.get("/products", listProductsPublicController);
publicProductRouter.get("/:slug", getProductBySlugController);

export default publicProductRouter;
