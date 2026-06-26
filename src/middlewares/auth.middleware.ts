import type { Request, Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void => {
  const { first_name, last_name, email, password } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All registration fields are required.",
    });
  }

  if (typeof first_name !== "string" || first_name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: "First name must be at least 2 characters.",
    });
  }

  if (typeof last_name !== "string" || last_name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: "Last name must be at least 2 characters.",
    });
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({
      success: false,
      message: "A valid email address is required.",
    });
  }

  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long.",
    });
  }

  next();
};

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    return req.body.email;
  },
  message: "Too many login attempts, try again later",
});


export const checkOwnership = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const token = req.headers.authorization?.split(" ")[1];
    try {
      const payload = jwt.verify(
        token as string,
        process.env.JWT_SECRET as string,
      );
      const user = {
        sub: (payload as any).sub,
        email: (payload as any).email,
        role: (payload as any).role,
      };
      req.user = user;
      console.log("Authenticated user ID:", req.user);
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err,
      });
    }
  },
);
