import { z } from "zod";
import bcrypt from "bcrypt";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain a special character");

export function validatePassword(
  password: string,
  extraContext?: { email?: string; firstName?: string; lastName?: string },
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    errors.push(...result.error.issues.map((e) => e.message));
  }

  const lowerPassword = password.toLowerCase();

  if (extraContext?.email) {
    const emailLocalPart = ((extraContext?.email ?? '').split("@")[0] ?? '').toLowerCase();
    if (lowerPassword.includes(emailLocalPart)) {
      errors.push("Password must not contain your email");
    }
  }

  if (extraContext?.firstName && extraContext.firstName.length >= 3) {
    if (lowerPassword.includes(extraContext.firstName.toLowerCase())) {
      errors.push("Password must not contain your first name");
    }
  }

  if (extraContext?.lastName && extraContext.lastName.length >= 3) {
    if (lowerPassword.includes(extraContext.lastName.toLowerCase())) {
      errors.push("Password must not contain your last name");
    }
  }

  return { valid: errors.length === 0, errors };
}

 
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}


export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
