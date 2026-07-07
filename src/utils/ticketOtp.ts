import jwt from "jsonwebtoken";

const TICKET_SECRET = process.env.REGISTRATION_TICKET_SECRET as string;

export const signRegistrationTicket = (pendingSignupId: string) => {
  return jwt.sign(
    { pendingSignupId, purpose: "signup_registration" },
    TICKET_SECRET,
    {
      expiresIn: "15m",
    },
  );
};

export const verifyRegistrationTicket = (
  ticket: string,
): { pendingSignupId: string } => {
  const payload = jwt.verify(ticket, TICKET_SECRET) as {
    pendingSignupId: string;
    purpose: string;
  };

  if (payload.purpose !== "signup_registration") {
    throw new Error("Invalid ticket purpose");
  }

  return { pendingSignupId: payload.pendingSignupId };
};
