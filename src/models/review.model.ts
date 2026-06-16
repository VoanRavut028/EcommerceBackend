import mongoose from "mongoose";
import { Query } from "mongoose";

interface IReview {
  user_id: mongoose.Types.ObjectId;
  product_id: mongoose.Types.ObjectId;
  order_id: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  verified_purchase: boolean;
  is_active: boolean;
}

const reviewSchema = new mongoose.Schema<IReview>(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
    verified_purchase: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
reviewSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

reviewSchema.index({ product_id: 1, createdAt: -1 });

reviewSchema.pre<Query<any, any>>(/^find/, async function () {
  this.where({ is_active: true });
});

export default mongoose.model<IReview>("Review", reviewSchema);
