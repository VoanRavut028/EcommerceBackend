import { Router } from "express";
import { authorize } from "../middlewares/authorize.middleware.ts";
import { checkOwnership } from "../middlewares/auth.middleware.ts";
import { validateBody } from "../middlewares/validate.middleware.ts";
import {
  addCartItemValidate,
  updateCartItemValidate,
} from "../utils/cartValidator.ts";
import {
  addCartItemController,
  clearCartController,
  getCartController,
  removeCartItemController,
  updateCartItemController,
} from "../controllers/cart.controller.ts";

const cartRouter = Router();

const userOnly = [checkOwnership, authorize("user")] as const;

cartRouter.get("/cart", ...userOnly, getCartController);
cartRouter.post(
  "/cart/items",
  ...userOnly,
  validateBody(addCartItemValidate),
  addCartItemController,
);
cartRouter.patch(
  "/cart/items/:itemId",
  ...userOnly,
  validateBody(updateCartItemValidate),
  updateCartItemController,
);
cartRouter.delete("/cart/items/:itemId", ...userOnly, removeCartItemController);
cartRouter.delete("/cart/items", ...userOnly, clearCartController);

export default cartRouter;
