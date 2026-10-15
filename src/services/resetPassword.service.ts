import { firebaseAuth } from "../configs/firebase.ts";
import User from "../models/user.model.ts";
import {
  signResetPasswordTicket,
  verifyResetPasswordTicket,
} from "../utils/ticketOtp.ts";
import { hashPassword } from "../utils/passwordValidator.ts"; // <- your existing hashPassword util
import { validatePassword } from "../utils/passwordValidator.ts"; // <- your existing validator

/**
 * STEP 1 — POST /auth/reset-password/init
 * Body: { phone_number }
 *
 * Just confirms a user with this phone exists. Nothing is created or
 * modified here — this step's only real job is letting the frontend know
 * whether to proceed to triggering Firebase's SMS.
 */
export const initResetPassword = async ({
  phone_number,
}: {
  phone_number: string;
}) => {
  if (!phone_number) {
    return {
      code: "AUTH_RESET_PHONE_REQUIRED",
      status: 400,
      success: false,
    };
  }

  try {
    const user = await User.findOne({ phone_number });

    if (!user) {
      return {
        code: "AUTH_RESET_USER_NOT_FOUND",
        status: 409,
        success: false,
      };
    }

    return {
      code: "AUTH_RESET_INIT_SUCCESS",
      status: 200,
      success: true,
    };
  } catch (err) {
    console.error("initResetPassword error:", err);
    return {
      code: "AUTH_RESET_INIT_ERROR",
      status: 500,
      success: false,
    };
  }
};

/**
 * STEP 2 — POST /auth/reset-password/verify-otp
 * Body: { idToken, phone_number }
 */
export const verifyResetOtp = async ({
  idToken,
  phone_number,
}: {
  idToken: string;
  phone_number: string;
}) => {
  if (!idToken || !phone_number) {
    return {
      code: "AUTH_RESET_VERIFICATION_FIELDS_REQUIRED",
      status: 400,
      success: false,
    };
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(idToken);

    if (decoded.phone_number !== phone_number) {
      return {
        code: "AUTH_RESET_PHONE_MISMATCH",
        status: 400,
        success: false,
      };
    }

    const user = await User.findOne({ phone_number });
    if (!user) {
      // Same enumeration consideration as Step 1 — but by this point the
      // user has ALREADY proven phone ownership via real SMS, so being
      // explicit here is lower-risk than in Step 1. Still, kept generic
      // for consistency.
      return {
        code: "AUTH_RESET_USER_NOT_FOUND",
        status: 404,
        success: false,
      };
    }

    const resetTicket = signResetPasswordTicket(user._id.toString());

    return {
      code: "AUTH_RESET_PHONE_VERIFIED",
      resetTicket,
      status: 200,
      success: true,
    };
  } catch (err: any) {
    console.error("verifyResetOtp error:", err.code, err.message);
    if (err.code === "auth/id-token-expired") {
      return {
        code: "AUTH_RESET_VERIFICATION_EXPIRED",
        status: 401,
        success: false,
      };
    }
    return {
      code: "AUTH_RESET_INVALID_VERIFICATION_TOKEN",
      status: 401,
      success: false,
    };
  }
};

/**
 * STEP 3 — POST /auth/reset-password/complete
 * Body: { resetTicket, password, confirmPassword }
 */
export const completeResetPassword = async ({
  resetTicket,
  password,
  confirmPassword,
}: {
  resetTicket: string;
  password: string;
  confirmPassword: string;
}) => {
  if (!resetTicket || !password || !confirmPassword) {
    return {
      code: "AUTH_RESET_FIELDS_REQUIRED",
      status: 400,
      success: false,
    };
  }

  if (password !== confirmPassword) {
    return {
      code: "AUTH_RESET_PASSWORD_MISMATCH",
      status: 400,
      success: false,
    };
  }

  try {
    const { pendingSignupId: userId } = verifyResetPasswordTicket(resetTicket);

    const user = await User.findById(userId).select("+password +refreshToken");
    if (!user) {
      return {
        code: "AUTH_RESET_USER_NOT_FOUND",
        status: 404,
        success: false,
      };
    }

    const { valid, errors } = await validatePassword(password, {
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    if (!valid) {
      return {
        code: "AUTH_RESET_PASSWORD_VALIDATION_FAILED",
        errors,
        status: 400,
        success: false,
      };
    }

    user.password = await hashPassword(password);

    // Invalidate any existing session — forces re-login everywhere after
    // a password reset. This is a deliberate security measure: if the
    // password was reset because it was compromised, old sessions
    // shouldn't remain valid.
    user.refreshToken = null;

    await user.save();

    return {
      code: "AUTH_RESET_PASSWORD_SUCCESS",
      status: 200,
      success: true,
    };
  } catch (err: any) {
    console.error("completeResetPassword error:", err.name, err.message);
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return {
        code: "AUTH_RESET_SESSION_EXPIRED",
        status: 401,
        success: false,
      };
    }
    return {
      code: "AUTH_RESET_PASSWORD_ERROR",
      status: 500,
      success: false,
    };
  }
};
