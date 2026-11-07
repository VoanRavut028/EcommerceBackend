import { Router } from "express";
import { authorize } from "../middlewares/authorize.middleware.ts";
import { checkOwnership } from "../middlewares/auth.middleware.ts";
import { validateBody } from "../middlewares/validate.middleware.ts";
import {
  cancelOrderController,
  checkoutController,
  getOrderController,
  listOrdersController,
  updateOrderStatusController,
} from "../controllers/order.controller.ts";
import {
  checkoutValidate,
  updateOrderStatusValidate,
} from "../utils/orderValidator.ts";

const orderRouter = Router();
const authenticated = [checkOwnership, authorize("user", "admin")] as const;
const adminOnly = [checkOwnership, authorize("admin")] as const;
const userOnly = [checkOwnership, authorize("user")] as const;

orderRouter.post(
  "/orders/checkout",
  ...userOnly,
  validateBody(checkoutValidate),
  checkoutController,
);
orderRouter.get("/orders", ...authenticated, listOrdersController);
orderRouter.get("/orders/:id", ...authenticated, getOrderController);
orderRouter.patch(
  "/orders/:id/status",
  ...adminOnly,
  validateBody(updateOrderStatusValidate),
  updateOrderStatusController,
);
orderRouter.post("/orders/:id/cancel", ...userOnly, cancelOrderController);

export default orderRouter;
