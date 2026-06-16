import mongoose from "mongoose";

interface IOrderItem {
  product_id: mongoose.Types.ObjectId;
  variant_sku?: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
}

interface IAddress {
  full_name: string;
  phone_number: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface IOrder {
  order_number: string;
  user_id: mongoose.Types.ObjectId;
  payment_id?: mongoose.Types.ObjectId | null;
  items: IOrderItem[];
  shipping_address: IAddress;
  billing_address?: IAddress | null;
  coupon_code?: string | null;
  coupon_discount: number;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  order_status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  shipping_method?: string | null;
  tracking_number?: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
}

const orderItemSchema = new mongoose.Schema<IOrderItem>(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant_sku: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true },
    phone_number: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema<IOrder>(
  {
    order_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
      unique: true,
      sparse: true,
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    shipping_address: {
      type: addressSchema,
      required: true,
    },
    billing_address: {
      type: addressSchema,
      default: null,
    },
    coupon_code: {
      type: String,
      default: null,
      trim: true,
    },
    coupon_discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    order_status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
    },
    shipping_method: {
      type: String,
      default: null,
    },
    tracking_number: {
      type: String,
      default: null,
      trim: true,
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

export default mongoose.model("Order", orderSchema);
