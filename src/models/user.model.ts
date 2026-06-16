import mongoose from "mongoose";

interface IAddress {
  label: string;
  phoneNumber: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
}

export interface IUser {
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
  avatar_url?: string | null;
  role: "user" | "admin" | "author";
  provider: "local" | "google" | "github";
  socialId?: string | null;
  address: IAddress[];
  refreshToken?: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends mongoose.Document, IUser {
  toPublicProfile(): {
    id?: mongoose.Types.ObjectId;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string | null;
    createdAt?: Date;
  };
}

const addressSchema = new mongoose.Schema<IAddress>(
  {
    label: { type: String, default: "home" },
    phoneNumber: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true, default: "KH" },
    is_default: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema<IUser>(
  {
    first_name: {
      type: String,
      required: true,
    },
    last_name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: false,
      select: false,
    },
    avatar_url: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin", "author"],
      default: "user",
    },
    provider: {
      type: String,
      required: true,
      enum: ["local", "google", "github"],
      default: "local",
    },
    socialId: {
      type: String,
      default: null,
      unique: true,
    },
    address: {
      type: [addressSchema],
      default: [],
    },
    refreshToken: {
      type: String,
      select: false,
      default: null,
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

userSchema.methods.toPublicProfile = function (
  this: mongoose.Document<unknown, IUser> & IUser,
) {
  return {
    id: this._id,
    first_name: this.first_name,
    last_name: this.last_name,
    email: this.email,
    avatar_url: this.avatar_url,
    createdAt: this.createdAt,
  };
};

const UserModel = mongoose.model(
  "User",
  userSchema,
) as unknown as mongoose.Model<IUserDocument>;
export default UserModel;
