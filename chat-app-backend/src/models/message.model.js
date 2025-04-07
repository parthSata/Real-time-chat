import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
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
    message: { type: String, ref: "Message", required: true }, // Last unread message4
    messageType: {
      type: String,
      enum: ["text", "image", "video"],
      default: "text",
    },
    delivered: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Message = mongoose.model("Message", MessageSchema);
