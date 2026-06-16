import asyncHandler from "express-async-handler";
import type { Request, Response } from "express";
import User from "../models/user.model.ts";

export const profile = async (req: Request, res: Response): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  const sub = (req.user as any).sub;
  const user = await User.findById(sub);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: user.toPublicProfile(),
  });
};
