import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Sender ID
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true }, // Chat ID
    content: { type: String, required: true }, // Message text
    messageType: { type: String, enum: ["text", "image", "file"], default: "text" }, // Message type
    fileUrl: { type: String, default: "" }, // If messageType is file/image
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who have read the message
}, { timestamps: true });

export const Message = mongoose.model("Message", MessageSchema);
