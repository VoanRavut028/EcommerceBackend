import dotenv from "dotenv";
dotenv.config();

import asynchandler from "express-async-handler";
import User from "../models/user.model.ts";

import passport from "../configs/passport.js";
import type { IUserDocument } from "../models/user.model.ts";
import {
  handleOAuthLogin,
  loginUser,
  refreshTokenService,
  completeRegistration,
  registerPendingUser,
  verifyRegister,
} from "../services/auth.service.ts";

import type { Request, Response, NextFunction } from "express";

// Google Auth
export const google = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("google", {
    session: false,
    scope: ["openid", "profile", "email"],
    prompt: "consent",
  })(req, res, next);
};

export const googleCallback = [
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
    })(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const userPayload = req.user as IUserDocument;
      const { accessToken, refreshToken, user } =
        await handleOAuthLogin(userPayload);

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const redirectUrl = new URL(
        `${process.env.FRONTEND_URL}/callbackview?provider=google`,
      );
      redirectUrl.searchParams.set("accessToken", accessToken);
      res.redirect(redirectUrl.toString());
      // res.redirect(`${process.env.FRONTEND_URL}/index?provider=google`);
      // console.log(
      //   `This is URL of access token ${process.env.FRONTEND_URL}/callbackview?provider=google`,
      // );
    } catch (err) {
      // console.error("googleCallback error:", err);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  },
];

// github auth

export const github = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("github", {
    session: false,
  })(req, res, next);
};
export const githubCallback = [
  passport.authenticate("github", {
    session: false,

    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
  }),
  async (req: Request, res: Response) => {
    const userPayload = req.user as IUserDocument;
    const { accessToken, refreshToken } = await handleOAuthLogin(userPayload);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const redirectUrl = new URL(
      `${process.env.FRONTEND_URL}/callbackview?provider=google`,
    );
    redirectUrl.searchParams.set("accessToken", accessToken);
    res.redirect(redirectUrl.toString());
  },
];

export const pendingRegister = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { first_name, last_name, email, phone_number } = req.body;
    const result = await registerPendingUser({
      first_name,
      last_name,
      email,
      phone_number,
    });
    return res.status(result.status).json({
      success: result.success,
      ...(result.pendingSignupId ? { user: result.pendingSignupId } : {}),
    });
  },
);

export const verifyRegisterOtp = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { idToken, phone_number } = req.body;
    const result = await verifyRegister({ idToken, phone_number });
    return res.status(result.status).json({
      success: result.success,
      message: result.message,
      ...(result.registrationTicket
        ? { registrationTicket: result.registrationTicket }
        : {}),
    });
  },
);

export const completeRegister = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { registrationTicket, password } = req.body;

    const result = await completeRegistration({
      registrationTicket,
      password,
    });
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(result.status).json({
      success: result.success,
      message: result.message,
      ...(result.user ? { user: result.user } : {}),
    });
  },
);

export const login = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;

    const result = await loginUser({ email, password });

    if (!result.success) {
      return res.status(result.status).json({
        message: result.message,
        success: false,
      });
    }

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(result.status).json({
      message: result.message,
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  },
);

export const refresh = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const refreshToken = req.cookies.refreshToken;
    const result = await refreshTokenService(refreshToken);

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        ...(result.payloadId ? { payloadId: result.payloadId } : {}),
        message: result.message,
      });
    }

    return res.status(result.status).json({
      success: true,
      message: result.message,
      accessToken: result.accessToken,
    });
  },
);

// export const logout = asynchandler(async (req: Request, res: Response): Promise<any> => {
//   const refreshToken = req.refreshToken; // from middleware

//   // Already logged out
//   if (!refreshToken) {
//     return res.status(200).json({
//       success: true,
//       message: "Logged out successfully",
//     });
//   }

//   // Revoke token in DB
//   await tokenService.revokeRefreshToken(refreshToken);

//   // Clear cookie
//   tokenService.clearRefreshCookie(res);

//   return res.status(200).json({
//     success: true,
//     message: "Logged out successfully",
//   });
// });
