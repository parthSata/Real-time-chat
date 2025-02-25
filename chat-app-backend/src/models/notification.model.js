import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who receives notification
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who sent the message
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" }, // Last unread message
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", NotificationSchema);
