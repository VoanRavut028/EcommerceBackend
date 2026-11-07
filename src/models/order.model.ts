import mongoose, { Schema, Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export interface IOrder {
  orderNumber: string;
  userId: Types.ObjectId;
  shippingAddress: {
    label: string;
    fullName: string;
    phoneNumber: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  status: OrderStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    shippingAddress: {
      label: { type: String, required: true },
      fullName: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, required: true },
    },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IOrder>("Order", orderSchema);
