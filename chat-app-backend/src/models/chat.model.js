import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    isGroupChat: { type: Boolean, default: false }, // True for group chats
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users in chat
    chatName: { type: String, default: "" }, // For group chats
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Group admin
  },
  { timestamps: true }
);

export const Chat = mongoose.model("Chat", ChatSchema);
