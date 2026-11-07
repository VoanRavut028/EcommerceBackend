import mongoose, { Schema, Types } from "mongoose";

export interface ICart {
  userId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model<ICart>("Cart", cartSchema);
