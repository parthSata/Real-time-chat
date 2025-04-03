// models/chat.model.js
import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    isGroupChat: { type: Boolean, default: false }, // True for group chats
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ], // Users in the chat
    chatName: {
      type: String,
      default: "",
      required: function () {
        return this.isGroupChat; // Required only for group chats
      },
    }, // Name for group chats
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.isGroupChat; // Required only for group chats
      },
    }, // Group admin (creator of the group chat)
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ], // References to messages in the chat
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: () => new Map(), // Stored as object in MongoDB
    },
  },
  { timestamps: true }
);

// Validation: Ensure at least two participants for non-group chats
ChatSchema.pre("save", function (next) {
  if (!this.isGroupChat && this.participants.length < 2) {
    next(new Error("Non-group chats must have at least two participants"));
  }
  next();
});

export const Chat = mongoose.model("Chat", ChatSchema);
