import mongoose, { Schema, Types } from "mongoose";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "partially_refunded"
  | "refunded";

export type PaymentCurrency = "USD" | "KHR";

export interface IPayment {
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  payment_option: "abapay";
  /** Merchant-generated ABA PayWay tran_id. */
  providerReference: string;
  amount: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  refundedAmount: number;
  paidAt: Date | null;
  refundedAt: Date | null;
  refundInProgress: boolean;
  pendingRefundAmount: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    payment_option: {
      type: String,
      enum: ["abapay"],
      required: true,
      default: "abapay",
    },
    providerReference: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 20,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: ["USD", "KHR"],
      required: true,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "partially_refunded", "refunded"],
      required: true,
      default: "pending",
      index: true,
    },
    refundedAmount: { type: Number, required: true, min: 0, default: 0 },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    refundInProgress: { type: Boolean, required: true, default: false },
    pendingRefundAmount: { type: Number, min: 0, default: null },
  },
  { timestamps: true },
);

paymentSchema.index({ orderId: 1, createdAt: -1 });
paymentSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      orderId: { $type: "objectId" },
      status: "pending",
    },
    name: "one_pending_payway_payment_per_order",
  },
);

export default mongoose.model<IPayment>("Payment", paymentSchema);
