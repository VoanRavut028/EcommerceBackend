import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import {
  initResetPassword,
  verifyResetOtp,
  completeResetPassword,
} from "../services/resetPassword.service.ts";

export const resetPasswordInit = asyncHandler(
  async (req: Request, res: Response): Promise<any> => {
    const { phone_number } = req.body;
    const result = await initResetPassword({ phone_number });
    return res
      .status(result.status)
      .json({ success: result.success, code: result.code });
  },
);

export const resetPasswordVerifyOtp = asyncHandler(
  async (req: Request, res: Response): Promise<any> => {
    const { idToken, phone_number } = req.body;
    const result = await verifyResetOtp({ idToken, phone_number });
    return res.status(result.status).json({
      success: result.success,
      code: result.code,
      ...(result.resetTicket ? { resetTicket: result.resetTicket } : {}),
    });
  },
);

export const resetPasswordComplete = asyncHandler(
  async (req: Request, res: Response): Promise<any> => {
    const { resetTicket, password, confirmPassword } = req.body;
    const result = await completeResetPassword({
      resetTicket,
      password,
      confirmPassword,
    });
    return res.status(result.status).json({
      success: result.success,
      code: result.code,
      ...(result.errors ? { errors: result.errors } : {}),
    });
  },
);
