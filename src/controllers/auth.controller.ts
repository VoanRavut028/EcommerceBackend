import dotenv from "dotenv";
dotenv.config();

import asynchandler from "express-async-handler";
import bcrypt from "bcryptjs";
import User from "../models/user.model.ts";
import jwt from "jsonwebtoken";
import passport from "../configs/passport.js";
import type { IUser, IUserDocument } from "../models/user.model.ts";

import type { Request, Response, NextFunction } from "express";
export const generateAccessToken = (user: IUserDocument) => {
  const payload = {
    sub: user._id?.toString(),
    email: user.email,
    role: user.role,
  } as unknown as jwt.JwtPayload;

  return jwt.sign(
    payload,
    process.env.JWT_SECRET as string,
    {
      expiresIn: process.env.JWT_EXPIRE as string,
      issuer: process.env.JWT_ISSUER as string,
      algorithm: "HS256",
    } as jwt.SignOptions,
  );
};

export const generateRefreshToken = (user: IUserDocument) => {
  const payload = {
    sub: user._id?.toString(),
    email: user.email,
    role: user.role,
  } as unknown as jwt.JwtPayload;

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET as string,
    {
      expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRE as string,
      issuer: process.env.JWT_ISSUER as string,
      algorithm: "HS256",
    } as jwt.SignOptions,
  );
};

// Google Auth
export const google = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("google", {
    session: false,
    scope: ["openid", "profile", "email"],
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

      const accessToken = generateAccessToken(userPayload);
      const refreshToken = generateRefreshToken(userPayload);

      await User.findByIdAndUpdate(
        userPayload._id,
        { refreshToken },
        { runValidators: false },
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(200).json({
        status: true,
        message: "Success",
        accessToken: accessToken,
        refreshToken: refreshToken,
        user: userPayload,
      });
      res.redirect(`${process.env.FRONTEND_URL}/callbackview?provider=google`);
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
    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);
    await User.findByIdAndUpdate(
      userPayload._id,
      { refreshToken },
      { runValidators: false },
    );
    res.status(200).json({
      accessToken: accessToken,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/callbackview?provider=github`);
  },
];

export const register = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { first_name, last_name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = (await User.create({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      provider: "local",
      role: "user",
    })) as unknown as IUserDocument;

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: user.toPublicProfile(),
    });
  },
);

export const login = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
        success: false,
      });
    }
    const checkPassword = await bcrypt.compare(
      password as string,
      user.password as string,
    );
    if (!checkPassword) {
      return res.status(401).json({
        message: "Invalid email or password.",
        success: false,
      });
    }
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await User.findByIdAndUpdate(
      user._id,
      { refreshToken },
      { runValidators: false },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // res.redirect(`${process.env.FRONTEND_URL}/callbackview?provider=local`);
    return res.status(200).json({
      message: "Login successful.",
      success: true,
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: user.toPublicProfile(),
    });
  },
);

export const refresh = asynchandler(
  async (req: Request, res: Response): Promise<any> => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,

        message: "Refresh token required",
      });
    }
    let payload;
    try {
      payload = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET as string,
      );
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    const user = await User.findById(payload.sub).select("+refreshToken");

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        payloadId: payload?.sub,
        message: "Refresh token not valid",
      });
    }

    const accessToken = generateAccessToken(user);
    console.log(`Cookies : ${req.cookies}`);
    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      accessToken: accessToken,
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
