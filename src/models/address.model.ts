import mongoose, { Schema, Types } from "mongoose";

export interface IAddress {
  userId: Types.ObjectId;
  label: string;
  fullName: string;
  phoneNumber: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phoneNumber: { type: String, required: true, trim: true, maxlength: 32 },
    street: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    zip: { type: String, required: true, trim: true, maxlength: 24 },
    country: { type: String, required: true, trim: true, maxlength: 2, uppercase: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

addressSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IAddress>("Address", addressSchema);
