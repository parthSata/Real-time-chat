// models/chat.model.js
import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    isGroupChat: { type: Boolean, default: false },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    chatName: {
      type: String,
      default: "",
      required: function () {
        return this.isGroupChat;
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.isGroupChat;
      },
    },
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

ChatSchema.pre("save", function (next) {
  if (!this.isGroupChat && this.participants.length < 2) {
    next(new Error("Non-group chats must have at least two participants"));
  }
  next();
});

export const Chat = mongoose.model("Chat", ChatSchema);
