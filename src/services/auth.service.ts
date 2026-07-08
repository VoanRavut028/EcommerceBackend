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
import { pendingRegister } from "../controllers/auth.controller.ts";
import { success } from "zod";
type RegisterInput = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

type LoginInput = {
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
        message: "Email or Phone number already exist.",
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
      message: "Pending signup created. Proceed to phone verification.",
      pendingSignupId: pendingUser._id,
      status: 201,
      success: true,
    };
  } catch (err) {
    return {
      message: "Error creating pending signup",
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
      status: 400,
      success: false,
      message: "idToken and phone_number are required",
    };
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);

    if (decoded.phone_number !== phone_number) {
      return {
        status: 400,
        success: false,
        message: "Phone number does not match verification token",
      };
    }

    const pending = await PendingRegister.findOne({ phone_number });
    if (!pending) {
      return {
        status: 404,
        success: false,
        message: "No pending signup found. Please restart signup.",
      };
    }

    pending.is_verified = true;
    pending.firebase_uid = decoded.uid;
    await pending.save();

    const registrationTicket = signRegistrationTicket(pending._id.toString());

    return {
      message: "Phone verified",
      registrationTicket,
      status: 200,
      success: true,
    };
  } catch (err: any) {
    if (err.code === "auth/id-token-expired") {
      return {
        message: "Verification session expired, please retry",
        status: 401,
        success: false,
      };
    }

    return {
      message: `Invalid or expired token ${err}`,
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
      message: "registrationTicket and password are required",
      status: 400,
      success: false,
    };
  }

  try {
    const { pendingSignupId } = verifyRegistrationTicket(registrationTicket);

    const pending = await PendingRegister.findById(pendingSignupId);
    if (!pending) {
      return {
        message: "Pending signup expired or not found. Please restart signup.",
        status: 404,
        success: false,
      };
    }

    if (!pending.is_verified) {
      return {
        message: "Phone number not verified yet",
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
        message: "Email or phone number already registered",
        status: 500,
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

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    return {
      accessToken,
      refreshToken,
      status: 201,
      success: true,
      message: "User registered successfully",
      user: user.toPublicProfile(),
    };
  } catch (err: any) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return {
        message:
          "Registration session expired. Please verify your phone again.",
        status: 401,
        success: false,
      };
    }
    return {
      message: "Failed to complete signup",
      status: 500,
      success: false,
    };
  }
};

export const loginUser = async ({ email, password }: LoginInput) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return {
      success: false,
      status: 401,
      message: "Invalid email or password.",
    };
  }

  if (!user.password) {
    return {
      success: false,
      status: 401,
      message: "Invalid email or password.",
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
      message: "Invalid email or password.",
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
    message: "Login successful.",
    accessToken,
    refreshToken,
    user: user.toPublicProfile(),
  };
};

export const refreshTokenService = async (refreshToken: string | undefined) => {
  if (!refreshToken) {
    return {
      success: false,
      status: 401,
      message: "Refresh token required",
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
      status: 400,
      message: err.message,
    };
  }

  const user = await User.findById(payload.sub).select("+refreshToken");

  if (!user || user.refreshToken !== refreshToken) {
    return {
      success: false,
      status: 401,
      payloadId: payload?.sub,
      message: "Refresh token not valid",
    };
  }

  const accessToken = generateAccessToken(user);

  return {
    success: true,
    status: 200,
    message: "Token refreshed successfully",
    accessToken,
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
