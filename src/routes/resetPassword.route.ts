import { Router } from "express";
import {
  resetPasswordInit,
  resetPasswordVerifyOtp,
  resetPasswordComplete,
} from "../controllers/resetPassword.controller.ts";

const resetPasswordRouter = Router();

// Step 1: confirm a user exists for this phone -> frontend then triggers
// Firebase SMS
resetPasswordRouter.post("/reset-password/init", resetPasswordInit);

// Step 2: verify Firebase idToken -> returns a short-lived resetTicket
resetPasswordRouter.post("/reset-password/verify-otp", resetPasswordVerifyOtp);

// Step 3: set new password using the resetTicket -> invalidates old
// sessions, updates User
resetPasswordRouter.post("/reset-password/complete", resetPasswordComplete);

export default resetPasswordRouter;