import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, required: true }, // URL of profile picture
    status: { type: String, default: "Hey there! I am using this chat app." },
    isOnline: { type: Boolean, default: false }, // Online status
    lastSeen: { type: Date, default: Date.now }, // Last active timestamp
  },
  { timestamps: true }
);

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      email: this.email,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIREY,
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIREY,
  });
};

export const User = mongoose.model("User", userSchema);
