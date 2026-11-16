import { Router } from "express";
import { createPayment, paywayCallback, refundPayment } from "../controllers/payment.controller.ts";
import { checkOwnership } from "../middlewares/auth.middleware.ts";
import { authorize } from "../middlewares/authorize.middleware.ts";
import { validateBody } from "../middlewares/validate.middleware.ts";
import { refundPaymentValidate } from "../utils/paymentValidator.ts";

const router = Router();

router.post("/callback", paywayCallback);
router.post("/purchase", checkOwnership, createPayment);
router.post(
  "/:id/refund",
  checkOwnership,
  authorize("admin"),
  validateBody(refundPaymentValidate),
  refundPayment,
);

export default router;
