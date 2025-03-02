import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    console.log("🚀 ~ verifyJWT ~ token:", token);

    if (!token) {
      throw new ApiError(401, "Unauthorized Request");
    }

    const decodedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("🚀 ~ verifyJWT ~ decodedInfo:", decodedInfo);

    const user = await User.findById(decodedInfo?.id).select(
      "-password -refreshToken "
    );
    console.log("🚀 ~ verifyJWT ~ user:", user);

    if (!user) {
      // discuss About Frontend
      throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;
    console.log("🚀 ~ verifyJWT ~ req.user:", req.user);
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || " Invalid Access token");
  }
});
