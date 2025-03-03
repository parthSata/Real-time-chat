// controllers/user.controller.js
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import path from "path"; // Import path for file handling
import { uploadInCloudinary } from "../utils/cloudinary.js"; // Adjust the path to your cloudinary file
import { asyncHandler } from "../utils/asyncHandler.js"; // Import asyncHandler (adjust path as needed)
import { ApiError } from "../utils/ApiError.js"; // Import ApiError (adjust path as needed)
import ApiResponse from "../utils/ApiResponse.js"; // Import ApiResponse (adjust path as needed)

// Register user function
const registerUser = asyncHandler(async (req, res) => {
  // Extract form-data fields from req.body (text fields)
  const { username, email, password, status, isOnline, lastSeen } = req.body;

  // Validation: Ensure required fields are provided and not empty
  if (!username?.trim() || !email?.trim() || !password?.trim()) {
    throw new ApiError(400, "Username, email, and password are required");
  }

  // Check if user already exists (by email or username)
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    throw new ApiError(
      400,
      existingUser.email === email
        ? "Email already exists"
        : "Username already taken"
    );
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Prepare user data
  const userData = {
    username: username.trim(),
    email: email.trim(),
    password: hashedPassword,
  };

  // Handle profilePic file upload (if provided) from req.files, not req.body
  if (req.files && req.files.profilePic) {
    const profilePicFile = req.files.profilePic[0]; // Get the first file (multer stores files in req.files)
    const uploadResult = await uploadInCloudinary(profilePicFile.path); // Upload to Cloudinary

    if (!uploadResult) {
      throw new ApiError(400, "Failed to upload profile picture to Cloudinary");
    }
    userData.profilePic = uploadResult.secure_url; // Store the Cloudinary URL
  } else {
    userData.profilePic = ""; // Default to empty string if no file is uploaded
  }

  // Add optional fields if provided
  if (status) userData.status = status;
  if (isOnline) userData.isOnline = isOnline === "true"; // Convert string to boolean
  if (lastSeen) userData.lastSeen = new Date(lastSeen); // Convert to Date if provided

  // Create new user
  const newUser = new User(userData);
  await newUser.save();

  // Generate access token
  const token = newUser.generateAccessToken();

  // Set cookie (optional)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.cookie("token", token, cookieOptions);

  // Send response using ApiResponse
  return res.status(201).json(
    new ApiResponse(201, "User registered successfully", {
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profilePic: newUser.profilePic,
        status: newUser.status,
        isOnline: newUser.isOnline,
      },
      token,
    })
  );
});

// Login user function
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

  // Generate access token
  const token = user.generateAccessToken();

  // Set cookie (optional)
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.cookie("token", token, cookieOptions);

  // Send response using ApiResponse
  return res.status(200).json(
    new ApiResponse(200, "Login successful", {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        status: user.status,
        isOnline: user.isOnline,
      },
      token,
    })
  );
});

// Logout user function
const logoutUser = asyncHandler(async (req, res) => {
  // Clear the token cookie
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.clearCookie("token", cookieOptions);

  // Optionally, update the user's online status to false
  const userId = req.user?.id; // Assuming you have middleware to decode the JWT and attach user to req.user
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      await user.save();
    }
  }

  // Send success response using ApiResponse
  return res
    .status(200)
    .json(new ApiResponse(200, "Logged out successfully", {}));
});

export { registerUser, loginUser, logoutUser };
