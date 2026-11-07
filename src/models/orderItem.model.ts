import mongoose, { Schema, Types } from "mongoose";

export interface IOrderItem {
  orderId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  productName: string;
  sku: string;
  options: Record<string, string>;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    options: { type: Schema.Types.Mixed, default: {} },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

orderItemSchema.index({ orderId: 1, createdAt: 1 });

export default mongoose.model<IOrderItem>("OrderItem", orderItemSchema);
