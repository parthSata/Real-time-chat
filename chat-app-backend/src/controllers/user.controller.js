import { User } from "../models/user.model.js";
import { uploadInCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, status, isOnline, lastSeen } = req.body;


  if (!username?.trim() || !email?.trim() || !password?.trim()) {
    throw new ApiError(400, "Username, email, and password are required");
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new ApiError(
      400,
      existingUser.email === email
        ? "Email already exists"
        : "Username already taken"
    );
  }

  const userData = {
    username: username.trim(),
    email: email.trim(),
    password,
  };

  if (req.files && req.files.profilePic) {
    try {
      const profilePicFile = req.files.profilePic[0];
      const uploadResult = await uploadInCloudinary(profilePicFile.path);
      if (uploadResult) {
        userData.profilePic = uploadResult.secure_url;
      } else {
        console.warn(
          "Failed to upload profile picture to Cloudinary, proceeding without it"
        );
      }
    } catch (error) {
      console.error(
        "Error uploading profile picture to Cloudinary:",
        error.message
      );
    }
  }

  if (status) userData.status = status;
  if (isOnline) userData.isOnline = isOnline === "true";
  if (lastSeen) userData.lastSeen = new Date(lastSeen);

  const newUser = new User(userData);
  await newUser.save();

  const accessToken = newUser.generateAccessToken();
  const refreshToken = newUser.generateRefreshToken();

  newUser.accessToken = accessToken;
  newUser.refreshToken = refreshToken;
  await newUser.save();

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.VITE_NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.VITE_NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const userResponse = {
    _id: newUser._id.toString(),
    username: newUser.username,
    email: newUser.email,
    profilePic: newUser.profilePic || "",
    status: newUser.status,
    isOnline: newUser.isOnline,
  };

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { user: userResponse, accessToken },
        "User registered successfully"
      )
    );
});

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

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.accessToken = accessToken;
  user.refreshToken = refreshToken;
  await user.save();

  const options = {
    httpOnly: true,
    secure: process.env.VITE_NODE_ENV === "production",
    sameSite: "strict",
  };

  const loggedInUser = {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    profilePic: user.profilePic || "",
    status: user.status,
    isOnline: user.isOnline,
  };


  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...options,
      maxAge: 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...options,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken },
        "Login successful"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      user.accessToken = null;
      user.refreshToken = null;
      await user.save();
    }
  }

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.VITE_NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.VITE_NODE_ENV === "production",
    sameSite: "strict",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

const searchUser = asyncHandler(async (req, res) => {
  const { username } = req.query;
  const currentUserId = req.user._id;

  if (!username) {
    throw new ApiError(400, "Username query parameter is required");
  }

  const user = await User.findOne({
    username: { $regex: `^${username}$`, $options: "i" },
  }).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user._id.toString() === currentUserId.toString()) {
    throw new ApiError(400, "Cannot search for yourself");
  }

  const userResponse = {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    profilePic: user.profilePic || "",
    status: user.status,
    isOnline: user.isOnline,
  };

  return res.status(200).json(new ApiResponse(200, userResponse, "User found"));
});

const updateProfile = asyncHandler(async (req, res) => {
  const { username, email, password, status } = req.body;
  const userId = req.user._id;

  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (password) updateData.password = await bcrypt.hash(password, 10);
  if (status) updateData.status = status;

  if (req.files?.profilePic) {
    const profilePicFile = req.files.profilePic[0];
    const uploadResult = await uploadInCloudinary(profilePicFile.path);
    if (uploadResult) {
      updateData.profilePic = uploadResult.secure_url;
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  const userResponse = {
    _id: updatedUser._id.toString(),
    username: updatedUser.username,
    email: updatedUser.email,
    profilePic: updatedUser.profilePic || "",
    status: updatedUser.status,
    isOnline: updatedUser.isOnline,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, userResponse, "Profile updated successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "User not authenticated");
  }

  const userData = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!userData) {
    throw new ApiError(404, "User not found");
  }

  const userResponse = {
    _id: userData._id.toString(),
    username: userData.username,
    email: userData.email,
    profilePic: userData.profilePic || "",
    status: userData.status,
    isOnline: userData.isOnline,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, { user: userResponse }, "User fetched successfully")
    );
});

const refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    throw new ApiError(401, "No refresh token provided");
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.VITE_REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decoded._id).select("+refreshToken");
    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.accessToken = newAccessToken;
    user.refreshToken = newRefreshToken;
    await user.save();

    const options = {
      httpOnly: true,
      secure: process.env.VITE_NODE_ENV === "production",
      sameSite: "strict",
    };

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, {
        ...options,
        maxAge: 24 * 60 * 60 * 1000,
      })
      .cookie("refreshToken", newRefreshToken, {
        ...options,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json(new ApiResponse(200, {}, "Token refreshed successfully"));
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
});

const getAllUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const users = await User.find({ _id: { $ne: currentUserId } })
    .select("_id username profilePic isOnline")
    .lean();

  const formattedUsers = users.map((user) => ({
    ...user,
    _id: user._id.toString(),
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, formattedUsers, "Users fetched successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  searchUser,
  refreshToken,
  updateProfile,
  getAllUsers,
};
