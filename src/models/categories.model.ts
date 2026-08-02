import mongoose, { Schema, Types } from "mongoose";

interface ICategory {
  title: string;
  slug: string;
  parent: Types.ObjectId | null;
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
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

categorySchema.pre("validate", function (next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title);
  }

  if (this.parent && this._id && this.parent.equals(this._id)) {
    this.invalidate("parent", "Category cannot be its own parent");
  }

  // next();
});

export default mongoose.model<ICategory>("Category", categorySchema);
