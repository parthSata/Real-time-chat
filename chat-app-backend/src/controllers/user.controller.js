import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import { uploadInCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

const registerUser = async (req, res) => {
  try {
    const { username, email, password, status, isOnline, lastSeen } = req.body;

    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      return res
        .status(400)
        .json({ message: "Username, email, and password are required" });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        message:
          existingUser.email === email
            ? "Email already exists"
            : "Username already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      username: username.trim(),
      email: email.trim(),
      password: hashedPassword,
    };

    if (req.files && req.files.profilePic) {
      const profilePicFile = req.files.profilePic[0];
      const uploadResult = await uploadInCloudinary(profilePicFile.path);
      if (uploadResult) {
        userData.profilePic = uploadResult.secure_url;
      } else {
        return res
          .status(400)
          .json({ message: "Failed to upload profile picture to Cloudinary" });
      }
    } else {
      userData.profilePic = "";
    }

    if (status) userData.status = status;
    if (isOnline) userData.isOnline = isOnline === "true";
    if (lastSeen) userData.lastSeen = new Date(lastSeen);

    const newUser = new User(userData);
    await newUser.save();

    const token = newUser.generateAccessToken();

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profilePic: newUser.profilePic,
        status: newUser.status,
        isOnline: newUser.isOnline,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save();

  const accessToken = user.generateAccessToken();

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  const loggedInUser = {
    id: user._id,
    username: user.username,
    email: user.email,
    profilePic: user.profilePic,
    status: user.status,
    isOnline: user.isOnline,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken },
        "Login successful"
      )
    );
});

const logoutUser = async (req, res) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    const userId = req.user?.id;
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        await user.save();
      }
    }

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profilePic: user.profilePic,
          status: user.status,
          isOnline: user.isOnline,
        },
      },
      "User fetched successfully"
    )
  );
});

export { registerUser, loginUser, logoutUser, getCurrentUser };
