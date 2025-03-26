import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  // Extract token from cookies or Authorization header
  const token =
    req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

  // Check if token exists
  if (!token) {
    throw new ApiError(401, "Unauthorized request: No access token provided");
  }

  // Verify the token
  const decodedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

  // Fetch user from database, excluding sensitive fields
  const user = await User.findById(decodedInfo?.id).select("-password -refreshToken");

  // Check if user exists
  if (!user) {
    throw new ApiError(401, "Invalid access token: User not found");
  }

  // Attach user to request object
  req.user = user;
  next();
});