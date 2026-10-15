import mongoose from "mongoose";
import type { HydratedDocument } from "mongoose";
import slugify from "slugify";
export interface IImage {
  url: string;
  public_id?: string;
  alt?: string;
  isPrimary?: boolean;
}
export interface IAttribute {
  name: string;
  value: string | number | boolean | (string | number)[];
  unit?: string;
}
export interface IVariant {
  sku: string;
  options: Map<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  images: IImage[];
  barcode?: string;
  weight?: number;
  isActive: boolean;
}

export interface IProduct {
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: mongoose.Types.ObjectId;
  categories?: mongoose.Types.ObjectId[];
  brand?: string;
  attributes: IAttribute[];
  images: IImage[];
  variants: IVariant[];
  minPrice?: number;
  maxPrice?: number;
  status: "draft" | "active" | "archived";
  isDeleted: boolean;
  deletedAt: Date | null;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  isDigital: boolean;
  requiresShipping: boolean;
}
const imageSchema = new mongoose.Schema<IImage>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    public_id: {
      type: String,
      trim: true,
    },
    alt: {
      type: String,
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    id: false,
  },
);
const attributeSchema = new mongoose.Schema<IAttribute>(
  {
    name: { type: String, required: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    unit: { type: String, trim: true },
  },
  { _id: false },
);
const variantSchema = new mongoose.Schema<IVariant>(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    options: {
      type: Map,
      of: String,
      default: {},
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: { type: Number, min: 0 },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    barcode: { type: String, trim: true },
    weight: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);
const ProductSchema = new mongoose.Schema<IProduct>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
     
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    shortDescription: { type: String, trim: true, maxlength: 500 },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    brand: {
      type: String,
      trim: true,
      index: true,
      maxlength: 100,
    },

    attributes: {
      type: [attributeSchema],
      default: [],
    },

    variants: {
      type: [variantSchema],
      default: [],
      validate: {
        validator: function (variants: any[]) {
          return variants.length > 0;
        },
        message: "Product must have at least one variant",
      },
    },

    minPrice: { type: Number, min: 0, default: null },
    maxPrice: { type: Number, min: 0, default: null },

    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: { type: Date, default: null },

    metaTitle: String,
    metaDescription: String,
    tags: [{ type: String, trim: true }],

    isDigital: { type: Boolean, default: false },
    requiresShipping: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

ProductSchema.index({ title: "text", description: "text", tags: "text" });
ProductSchema.index({ "variants.sku": 1 }, { unique: true, sparse: true });
ProductSchema.index({ category: 1, status: 1, isDeleted: 1 });
ProductSchema.index({ brand: 1, status: 1 });
ProductSchema.index({ minPrice: 1, maxPrice: 1 });
ProductSchema.index({ "attributes.name": 1, "attributes.value": 1 });

ProductSchema.pre("save", async function (this: HydratedDocument<IProduct>) {
  if (this.variants && this.variants.length > 0) {
    const prices = this.variants.filter((v) => v.isActive).map((v) => v.price);

    if (prices.length > 0) {
      this.minPrice = Math.min(...prices);
      this.maxPrice = Math.max(...prices);
    } else {
      this.minPrice = 0;
      this.maxPrice = 0;
    }
  }
});
ProductSchema.pre("save", async function () {
  if (this.isModified("title")) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
    });
  }
  if (!this.metaTitle || this.metaTitle.trim() === "") {
    this.metaTitle = this.title;
  }
  if (!this.metaDescription || this.metaDescription.trim() === "") {
    this.metaDescription =
      this.shortDescription || this.description?.substring(0, 160);
  }
});
export default mongoose.model("Product", ProductSchema);
