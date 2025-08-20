// models/user.model.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, select: false },
    profilePic: { type: String, default: "" },
    status: { type: String, default: "Hey there! I am using this chat app." },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date },
    accessToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  const isMatch = await bcrypt.compare(password, this.password);
  return isMatch;
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, username: this.username },
    process.env.VITE_ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.VITE_ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.VITE_REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.VITE_REFRESH_TOKEN_EXPIRY,
  });
};

export const User = mongoose.model("User", userSchema);
