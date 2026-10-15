import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.ts";
import type { IUserDocument } from "../models/user.model.ts";
import { generateAccessToken, generateRefreshToken } from "../utils/token.ts";
import type { IPendingRegister } from "../models/pendingRegister.model.ts";
import PendingRegister from "../models/pendingRegister.model.ts";
import { firebaseAuth } from "../configs/firebase.ts";
import {
  signRegistrationTicket,
  verifyRegistrationTicket,
} from "../utils/ticketOtp.ts";
import {
  validatePassword,
  hashPassword,
  verifyPassword,
} from "../utils/passwordValidator.ts";
import { hashToken } from "../utils/token.ts";
type RegisterInput = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

type LoginInput = {
  phone: string;
  password: string;
};
type LoginCredentialEmail = {
  email: string;
  password: string;
};
export const registerPendingUser = async ({
  first_name,
  last_name,
  email,
  phone_number,
}: IPendingRegister) => {
  try {
    const user = await User.findOne({ $or: [{ email }, { phone_number }] });
    if (user) {
      return {
        code: "AUTH_USER_ALREADY_EXISTS",
        status: 409,
        success: false,
      };
    }

    const pendingUser = await PendingRegister.findOneAndUpdate(
      { phone_number },
      {
        first_name,
        last_name,
        email,
        phone_number,
        firebase_uid: null,
        is_verified: false,
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      code: "AUTH_PENDING_SIGNUP_CREATED",
      pendingSignupId: pendingUser._id,
      status: 201,
      success: true,
    };
  } catch (err) {
    return {
      code: "AUTH_PENDING_SIGNUP_ERROR",
      status: 500,
      success: false,
    };
  }
};

export const verifyRegister = async ({
  idToken,
  phone_number,
}: {
  idToken: string;
  phone_number: string;
}) => {
  if (!idToken || !phone_number) {
    return {
      code: "AUTH_INVALID_VERIFICATION_REQUEST",
      status: 400,
      success: false,
    };
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);

    if (decoded.phone_number !== phone_number) {
      return {
        code: "AUTH_PHONE_NUMBER_MISMATCH",
        status: 400,
        success: false,
      };
    }

    const pending = await PendingRegister.findOne({ phone_number });
    if (!pending) {
      return {
        code: "AUTH_PENDING_SIGNUP_NOT_FOUND",
        status: 404,
        success: false,
      };
    }

    pending.is_verified = true;
    pending.firebase_uid = decoded.uid;
    await pending.save();

    const registrationTicket = signRegistrationTicket(pending._id.toString());

    return {
      code: "AUTH_PHONE_VERIFIED",
      registrationTicket,
      status: 200,
      success: true,
    };
  } catch (err: any) {
    if (err.code === "auth/id-token-expired") {
      return {
        code: "AUTH_VERIFICATION_SESSION_EXPIRED",
        status: 401,
        success: false,
      };
    }

    return {
      code: "AUTH_INVALID_VERIFICATION_TOKEN",
      status: 401,
      success: false,
    };
  }
};

export const completeRegistration = async ({
  registrationTicket,
  password,
}: {
  registrationTicket: string;
  password: string;
}) => {
  if (!registrationTicket || !password) {
    return {
      code: "AUTH_INVALID_REGISTRATION_REQUEST",
      status: 400,
      success: false,
    };
  }

  try {
    const { pendingSignupId } = verifyRegistrationTicket(registrationTicket);

    const pending = await PendingRegister.findById(pendingSignupId);
    if (!pending) {
      return {
        code: "AUTH_PENDING_SIGNUP_NOT_FOUND",
        status: 404,
        success: false,
      };
    }

    if (!pending.is_verified) {
      return {
        code: "AUTH_PHONE_NOT_VERIFIED",
        status: 400,
        success: false,
      };
    }
    const { valid, errors } = await validatePassword(password, {
      email: pending.email,
      firstName: pending.first_name,
      lastName: pending.last_name,
    });

    if (!valid) {
      return {
        code: "AUTH_PASSWORD_VALIDATION_FAILED",
        errors,
        status: 400,
        success: false,
      };
    }
    const hashedPassword = await hashPassword(password);

    const existingUser = await User.findOne({
      $or: [{ email: pending.email }, { phone_number: pending.phone_number }],
    });
    if (existingUser) {
      return {
        code: "AUTH_USER_ALREADY_EXISTS",
        status: 409,
        success: false,
      };
    }

    const user = await User.create({
      first_name: pending.first_name,
      last_name: pending.last_name,
      email: pending.email,
      phone_number: pending.phone_number,
      is_phone_verified: true,
      password: hashedPassword,
      provider: "local",
      ...(pending.firebase_uid ? { firebase_uid: pending.firebase_uid } : {}),
    });

    await PendingRegister.deleteOne({ _id: pending._id });

    return {
      code: "AUTH_REGISTRATION_SUCCESS",
      status: 201,
      success: true,
      user: user.toPublicProfile(),
    };
  } catch (err: any) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return {
        code: "AUTH_REGISTRATION_SESSION_EXPIRED",
        status: 401,
        success: false,
      };
    }
    return {
      code: "AUTH_REGISTRATION_ERROR",
      status: 500,
      success: false,
    };
  }
};

export const loginUser = async ({ phone, password }: LoginInput) => {
  if (!phone || !password) {
    return {
      success: false,
      status: 404,
      code: "AUTH_INVALID_CREDENTIALS",
    };
  }
  const user = await User.findOne({ phone_number: phone }).select("+password");
  console.log("Phone:", phone, "Password:", password);
  console.log("User found:", user);
  if (!user) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_CREDENTIALS",
    };
  }

  if (!user.password) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_CREDENTIALS",
    };
  }

  const checkPassword = await verifyPassword(
    password as string,
    user.password as string,
  );

  if (!checkPassword) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_CREDENTIALS",
    };
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await User.findByIdAndUpdate(
    user._id,
    { refreshToken },
    { runValidators: false },
  );

  return {
    success: true,
    status: 200,
    code: "AUTH_LOGIN_SUCCESS",
    accessToken,
    refreshToken,
    user: user.toPublicProfile(),
  };
};
export const loginCredentailEmail = async ({
  email,
  password,
}: LoginCredentialEmail) => {
  if (!email || !password) {
    return {
      success: false,
      status: 408,
      code: "AUTH_INVALID_CREDENTIALS_EMAIL",
    };
  }
  const user = await User.findOne({ email }).select("+password");
  console.log("Email:", email, "Password:", password);
  console.log("User found:", user);
  if (!user) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_CREDENTIALS_EMAIL",
    };
  }

  if (!user.password) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_CREDENTIALS_EMAIL",
    };
  }

  const checkPassword = await verifyPassword(
    password as string,
    user.password as string,
  );

  if (!checkPassword) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_CREDENTIALS_EMAIL",
    };
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    success: true,
    status: 200,
    code: "AUTH_LOGIN_SUCCESS",
    accessToken,
    refreshToken,
  };
};
export const logoutUser = async (refreshToken?: string): Promise<void> => {
  if (!refreshToken) return;

  try {
    const tokenHash = hashToken(refreshToken);

    await User.deleteOne({
      tokenHash,
    });
  } catch {}
};

export const refreshTokenService = async (refreshToken: string | undefined) => {
  if (!refreshToken) {
    return {
      success: false,
      status: 401,
      code: "AUTH_REFRESH_TOKEN_REQUIRED",
    };
  }

  let payload: jwt.JwtPayload;

  try {
    payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string,
    ) as jwt.JwtPayload;
  } catch (err: any) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_REFRESH_TOKEN",
    };
  }

  const user = await User.findById(payload.sub).select("+refreshToken");

  if (!user || user.refreshToken !== refreshToken) {
    return {
      success: false,
      status: 401,
      payloadId: payload?.sub,
      code: "AUTH_INVALID_REFRESH_TOKEN",
    };
  }

  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  user.refreshToken = newRefreshToken;
  await user.save();

  return {
    success: true,
    status: 200,
    code: "AUTH_TOKEN_REFRESHED",
    accessToken,
    refreshToken: newRefreshToken,
  };
};

export const handleOAuthLogin = async (userPayload: IUserDocument) => {
  const accessToken = generateAccessToken(userPayload);
  const refreshToken = generateRefreshToken(userPayload);

  await User.findByIdAndUpdate(
    userPayload._id,
    { refreshToken },
    { runValidators: false },
  );

  return {
    accessToken,
    refreshToken,
    user: userPayload,
  };
};
