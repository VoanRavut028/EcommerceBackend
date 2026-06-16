import mongoose from "mongoose";

interface ICartItem {
  product_id: mongoose.Types.ObjectId;
  variant_sku?: string;
  quantity: number;
  price: number;
  total: number;
}

interface ICart {
  user_id: mongoose.Types.ObjectId;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}

const cartItemSchema = new mongoose.Schema<ICartItem>(
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
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
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

const cartSchema = new mongoose.Schema<ICart>(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
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
    total: {
      type: Number,
      default: 0,
      min: 0,
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

export default mongoose.model("Cart", cartSchema);
