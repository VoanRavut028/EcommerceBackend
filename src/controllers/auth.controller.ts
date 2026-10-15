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
  logoutUser,
  loginCredentailEmail,
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
      code: result.code,
      status: result.status,
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
      code: result.code,
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

    return res.status(result.status).json({
      success: result.success,
      code: result.code,
      ...(result.errors ? { errors: result.errors } : {}),
      ...(result.user ? { user: result.user } : {}),
    });
  },
);

export const login = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { phone, password } = req.body;

    const result = await loginUser({ phone, password });

    if (!result.success) {
      console.log("Login failed:", result.code);
      return res.status(result.status).json({
        code: result.code,
        success: false,
        status: result.status,
      });
    }

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(result.status).json({
      code: result.code,
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  },
);
export const loginCredentialEmail = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;

    const result = await loginCredentailEmail({ email, password });

    if (!result.success) {
      console.log("Login failed:", result.code);
      return res.status(result.status).json({
        code: result.code,
        success: false,
        status: result.status,
      });
    }

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(result.status).json({
      code: result.code,
      success: true,
      accessToken: result.accessToken,
    });
  },
);

export const logout = asynchandler(
  async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken;

    await logoutUser(refreshToken);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    });

    res.status(200).json({
      success: true,
      code: "AUTH_LOGOUT_SUCCESS",
    });
  },
);

export const refresh = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const oldRefreshToken = req.cookies.refreshToken;
    const result = await refreshTokenService(oldRefreshToken);

    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        code: result.code,
        ...(result.payloadId ? { payloadId: result.payloadId } : {}),
      });
    }

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(result.status).json({
      success: true,
      code: result.code,
      accessToken: result.accessToken,
    });
  },
);
