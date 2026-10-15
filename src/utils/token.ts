import jwt from "jsonwebtoken";
import type { IUser, IUserDocument } from "../models/user.model.ts";
import bcrypt from "bcryptjs";
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

export async function hashToken(token: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(token, saltRounds);
}
