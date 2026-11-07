import { Router } from "express";
import { createPayment } from "../controllers/payment.controller.ts";
import { checkOwnership } from "../middlewares/auth.middleware.ts";

const router = Router();

router.post("/purchase", checkOwnership, createPayment);

export default router;
