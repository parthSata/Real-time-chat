// controllers/user.controller.js
import { User } from "../models/user.model.js";
import { uploadInCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// Register a new user
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, status, isOnline, lastSeen } = req.body;

  console.log(`Registering user with email: ${email}`);

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
      // Continue without the profile picture
    }
  }

  if (status) userData.status = status;
  if (isOnline) userData.isOnline = isOnline === "true";
  if (lastSeen) userData.lastSeen = new Date(lastSeen);

  const newUser = new User(userData);
  console.log("Saving new user to MongoDB Atlas...");
  await newUser.save();
  console.log("User saved successfully:", newUser._id);

  const accessToken = newUser.generateAccessToken();
  const refreshToken = newUser.generateRefreshToken();

  newUser.accessToken = accessToken;
  newUser.refreshToken = refreshToken;
  console.log("Saving access and refresh tokens...");
  await newUser.save();
  console.log("Tokens saved successfully");

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const userResponse = {
    id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    profilePic: newUser.profilePic,
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

// Log in a user
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log(`Login attempt for email: ${email}`);

  if (!email || !password) {
    console.log("Email or password missing");
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    console.log(`User not found for email: ${email}`);
    throw new ApiError(401, "Invalid email or password");
  }

  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    console.log(`Password does not match for email: ${email}`);
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

  console.log(`Login successful for email: ${email}`);
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

// Log out the current user
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "User not authenticated");
  }

  // Optionally, fetch the user from the database to ensure the data is fresh
  const userData = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!userData) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { user: userData }, "User fetched successfully")
    );
});
const searchUser = asyncHandler(async (req, res) => {
  const { username } = req.query;
  const currentUserId = req.user._id;

  if (!username) {
    throw new ApiError(400, "Username query parameter is required");
  }

  // Perform a case-insensitive search
  const user = await User.findOne({
    username: { $regex: `^${username}$`, $options: "i" },
  }).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user._id.toString() === currentUserId.toString()) {
    throw new ApiError(400, "Cannot search for yourself");
  }

  return res.status(200).json(new ApiResponse(200, user, "User found"));
});

// Refresh token endpoint
const refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    throw new ApiError(401, "No refresh token provided");
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
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
      secure: process.env.NODE_ENV === "production",
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

export {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  searchUser,
  refreshToken,
};
