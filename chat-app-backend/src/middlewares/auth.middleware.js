// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request: No access token provided");
  }

  let decodedInfo;
  try {
    decodedInfo = jwt.verify(token, process.env.VITE_ACCESS_TOKEN_SECRET);
    if (!decodedInfo?._id) {
      throw new ApiError(401, "Invalid access token: No user ID in token");
    }
  } catch (error) {
    throw new ApiError(401, `Invalid access token: ${error.message}`);
  }

  console.log("Decoded token user ID:", decodedInfo._id); // Debug log

  const user = await User.findById(decodedInfo._id).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw new ApiError(401, "Invalid access token: User not found");
  }

  req.user = user; // Ensure req.user contains the full user object
  console.log("Verified user ID:", req.user._id.toString()); // Debug log
  next();
});
