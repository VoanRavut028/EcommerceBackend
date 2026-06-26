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
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
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

// ===== INDEXES =====
userSchema.index(
  { provider: 1, socialId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      socialId: { $type: "string" }, // Only apply when socialId is not null
    },
    name: "unique_provider_socialId",
  },
);

userSchema.index(
  { email: 1, provider: 1 },
  {
    unique: true,
    name: "unique_email_provider",
  },
);

userSchema.index({ email: 1 }, { name: "idx_email" });

userSchema.index({ isDeleted: 1 }, { name: "idx_isDeleted" });

userSchema.index({ role: 1, isDeleted: 1 }, { name: "idx_role_isDeleted" });

userSchema.index(
  { isDeleted: 1, deletedAt: 1 },
  { name: "idx_isDeleted_deletedAt" },
);

userSchema.index(
  { first_name: "text", last_name: "text", email: "text" },
  { name: "idx_text_search" },
);

const UserModel = mongoose.model(
  "User",
  userSchema,
) as unknown as mongoose.Model<IUserDocument>;
export default UserModel;
