import mongoose from "mongoose";

export interface IPendingRegister {
  first_name: string;
  last_name: string;
  email: string;
  firebase_uid?: string;
  phone_number: string;
  is_verified?: boolean;
  expires_at?: Date;
}

const pendingRegisterSchema = new mongoose.Schema<IPendingRegister>(
  {
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
    },
    firebase_uid: {
      type: String,
      default: null,
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000),
    },
  },
  { timestamps: true },
);

pendingRegisterSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
pendingRegisterSchema.index({ phone_number: 1 });
pendingRegisterSchema.index({ email: 1 });

export default mongoose.model("PendingRegister", pendingRegisterSchema);
