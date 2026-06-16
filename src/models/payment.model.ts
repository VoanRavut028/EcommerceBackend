import mongoose from "mongoose";

interface IPayment {
  user_id: mongoose.Types.ObjectId;
  order_id: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  payment_method: string;
  payment_gateway: string;
  transaction_id: string;
  status: "pending" | "completed" | "failed" | "refunded";
  metadata?: Record<string, unknown> | null;
  isDeleted: boolean;
  deletedAt: Date | null;
}

const paymentSchema = new mongoose.Schema<IPayment>(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
    },
    payment_method: {
      type: String,
      required: true,
    },
    payment_gateway: {
      type: String,
      required: true,
      default: "stripe",
    },
    transaction_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    metadata: {
      type: Object,
      default: null,
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

export default mongoose.model("Payment", paymentSchema);
