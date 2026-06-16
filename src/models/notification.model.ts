import mongoose from "mongoose";

interface INotification {
  user_id: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
}

const notificationSchema = new mongoose.Schema<INotification>(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      default: "system",
    },
    metadata: {
      type: Object,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
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

export default mongoose.model("Notification", notificationSchema);
