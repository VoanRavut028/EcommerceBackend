import mongoose, { Schema, Types } from "mongoose";

export const CATEGORY_TYPES = ["women", "men", "kids", "accessories"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export interface ICategory {
  title: string;
  slug: string;
  parent: Types.ObjectId | null;
  type: CategoryType;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
}

const categorySchema = new Schema<ICategory>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: CATEGORY_TYPES,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
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

// A slug identifies a category within its department/type. The same slug may
// therefore be used once for men and once for kids, but not twice for men.
categorySchema.index({ type: 1, slug: 1 }, { unique: true, name: "type_1_slug_1" });

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

categorySchema.pre("validate", function () {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title);
  }

  if (this.parent && this._id && this.parent.equals(this._id)) {
    this.invalidate("parent", "Category cannot be its own parent");
  }
});

export default mongoose.model<ICategory>("Category", categorySchema);
