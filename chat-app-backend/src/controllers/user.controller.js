import { User } from "../models/user.model.js";
import { uploadInCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const cookieOptions = {
  httpOnly: true,
  secure: true, // Required for cross-site cookies
  sameSite: "None", // Required for cross-site cookies
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

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
    const profilePicFile = req.files.profilePic[0];
    const uploadResult = await uploadInCloudinary(profilePicFile.path);
    if (uploadResult) {
      userData.profilePic = uploadResult.secure_url;
    }
  }

  const newUser = new User(userData);
  await newUser.save();

  const accessToken = newUser.generateAccessToken();
  const refreshToken = newUser.generateRefreshToken();

  newUser.accessToken = accessToken;
  newUser.refreshToken = refreshToken;
  await newUser.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  return res
    .status(201)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json(
      // FIX: Swapped message and data
      new ApiResponse(201, "User registered successfully", {
        user: loggedInUser,
        accessToken,
      })
    );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.accessToken = accessToken;
  user.refreshToken = refreshToken;
  user.isOnline = true;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json(
      // FIX: Swapped message and data
      new ApiResponse(200, "Login successful", {
        user: loggedInUser,
        accessToken,
      })
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (userId) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        isOnline: false,
        lastSeen: new Date(),
        refreshToken: null,
        accessToken: null,
      },
    });
  }

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions); // FIX: Swapped message and data

  return res
    .status(200)
    .json(new ApiResponse(200, "Logged out successfully", {}));
});

const refreshToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "No refresh token provided");
  }

  try {
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.VITE_REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decoded._id);
    if (!user || user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.accessToken = newAccessToken;
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60 * 1000,
      })
      .cookie("refreshToken", newRefreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json(
        // FIX: Swapped message and data
        new ApiResponse(200, "Token refreshed successfully", {
          accessToken: newAccessToken,
        })
      );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
});

const searchUser = asyncHandler(async (req, res) => {
  const { username } = req.query;
  const currentUserId = req.user._id;

  let users;

  if (username && username.trim() !== "") {
    users = await User.find({
      username: { $regex: username, $options: "i" },
      _id: { $ne: currentUserId },
    }).select("-password -refreshToken");
  } else {
    users = await User.find({ _id: { $ne: currentUserId } }).select(
      "-password -refreshToken"
    );
  } // FIX: Swapped message and data

  return res
    .status(200)
    .json(new ApiResponse(200, "Users fetched successfully", users));
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
  }; // FIX: Swapped message and data

  return res
    .status(200)
    .json(new ApiResponse(200, "Profile updated successfully", userResponse));
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
  }; // FIX: Swapped message and data

  return res
    .status(200)
    .json(
      new ApiResponse(200, "User fetched successfully", { user: userResponse })
    );
});

const getAllUsers = asyncHandler(async (req, res) => {
  console.log('getAllUsers endpoint hit');
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
    .json(new ApiResponse(200, "Users fetched successfully", formattedUsers));
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
