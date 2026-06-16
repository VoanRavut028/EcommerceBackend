import mongoose from "mongoose";

interface IWishlistItem {
  product_id: mongoose.Types.ObjectId;
  variant_sku?: string;
  addedAt: Date;
}

interface IWishlist {
  user_id: mongoose.Types.ObjectId;
  items: IWishlistItem[];
  isDeleted: boolean;
  deletedAt: Date | null;
}

const wishlistItemSchema = new mongoose.Schema<IWishlistItem>(
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
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const wishlistSchema = new mongoose.Schema<IWishlist>(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [wishlistItemSchema],
      default: [],
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

export default mongoose.model("Wishlist", wishlistSchema);
