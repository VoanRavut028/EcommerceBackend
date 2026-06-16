import mongoose from "mongoose";

interface ICoupon {
  code: string;
  description?: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number | null;
  usageLimit: number;
  usedCount: number;
  userLimit?: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
}

const couponSchema = new mongoose.Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    discountType: {
      type: String,
      required: true,
      enum: ["fixed", "percent"],
      default: "fixed",
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      default: null,
      min: 0,
    },
    usageLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    userLimit: {
      type: Number,
      default: null,
      min: 0,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Coupon", couponSchema);
