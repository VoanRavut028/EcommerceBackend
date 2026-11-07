import mongoose, { Schema, Types } from "mongoose";

export interface ICartItem {
  cartId: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    cartId: {
      type: Schema.Types.ObjectId,
      ref: "Cart",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: true },
);

cartItemSchema.index({ cartId: 1, productId: 1, variantId: 1 }, { unique: true });

export default mongoose.model<ICartItem>("CartItem", cartItemSchema);
