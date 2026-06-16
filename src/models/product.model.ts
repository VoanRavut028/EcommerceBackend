import mongoose from "mongoose";
interface IAttribute {
  key: string;
  value: string;
  code: string | null;
}
interface IImage {
  url: string;
}
export interface IVariant {
  sku: string;
  price: number;
  stock: number;
  images: string[];
  attributes: IAttribute[];
}
interface IProduct {
  title: string;
  description: string;
  category_id: mongoose.Types.ObjectId;
  brand?: string;
  variants: [IVariant];
  isDeleted: boolean;
  deletedAt: Date | null;
}
const attribute = new mongoose.Schema<IAttribute>({
  key: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    default: null,
  },
});
const imageSchema = new mongoose.Schema<IImage>({
  url: {
    type: String,
    required: true,
  },
});
const variantSchema = new mongoose.Schema<IVariant>({
  sku: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  images: [imageSchema],
  attributes: [attribute],
});
const ProductSchema = new mongoose.Schema<IProduct>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
    },
    brand: { type: String, required: true },
    variants: [variantSchema],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Product", ProductSchema);
