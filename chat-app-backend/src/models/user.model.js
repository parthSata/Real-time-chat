import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" }, // URL of profile picture
    status: { type: String, default: "Hey there! I am using this chat app." },
    isOnline: { type: Boolean, default: false }, // Online status
    lastSeen: { type: Date, default: Date.now }, // Last active timestamp
  },
  { timestamps: true }
);

export const Usert = mongoose.model("User", userSchema);
