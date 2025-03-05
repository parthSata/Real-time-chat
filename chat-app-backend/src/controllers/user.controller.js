// controllers/user.controller.js
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import path from "path"; // Import path for file handling
import { uploadInCloudinary } from "../utils/cloudinary.js"; // Adjust the path to your cloudinary file
import { asyncHandler } from "../utils/asyncHandler.js"; // Import asyncHandler (adjust path as needed)
import { ApiError } from "../utils/ApiError.js"; // Import ApiError (adjust path as needed)
import ApiResponse from "../utils/ApiResponse.js"; // Import ApiResponse (adjust path as needed)
const registerUser = async (req, res) => {
  try {
    // Extract form-data fields from req.body (text fields)
    const { username, email, password, status, isOnline, lastSeen } = req.body;

    // Validation: Ensure required fields are provided and not empty
    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      return res
        .status(400)
        .json({ message: "Username, email, and password are required" });
    }

    // Check if user already exists (by email or username)
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        message:
          existingUser.email === email
            ? "Email already exists"
            : "Username already taken",
      });
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

      if (uploadResult) {
        userData.profilePic = uploadResult.secure_url; // Store the Cloudinary URL
      } else {
        return res
          .status(400)
          .json({ message: "Failed to upload profile picture to Cloudinary" });
      }
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
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // Send response
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

const loginUser = async (req, res) => {
  // Your existing loginUser function (unchanged for now)
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = user.generateAccessToken();

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        status: user.status,
        isOnline: user.isOnline,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// New logoutUser function
const logoutUser = async (req, res) => {
  try {
    // Clear the token cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

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

    // Send success response
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export { registerUser, loginUser, logoutUser };