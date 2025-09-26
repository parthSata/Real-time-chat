import express from "express";
import { body, validationResult, query } from "express-validator";
import rateLimit from "express-rate-limit";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  searchUser,
  refreshToken,
  updateProfile,
  getAllUsers,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { ApiError } from "../utils/ApiError.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }
  next();
};

router
  .route("/register")
  .post(upload.fields([{ name: "profilePic", maxCount: 1 }]), registerUser);

router
  .route("/login")
  .post(
    [
      body("email").isEmail().withMessage("Please provide a valid email"),
      body("password").notEmpty().withMessage("Password is required"),
      validate,
    ],
    loginUser
  );

router.route("/logout").post(verifyJWT, logoutUser);
router.get("/me", verifyJWT, getCurrentUser);

router.get(
  "/search",
  verifyJWT,
  // [
  //   query("username")
  //     .trim()
  //     .isLength({ min: 1 })
  //     .withMessage("Username query is required"),
  //   validate,
  // ],
  searchUser
);

router.get("/all", verifyJWT, getAllUsers);

router
  .route("/update-profile")
  .put(
    verifyJWT,
    upload.fields([{ name: "profilePic", maxCount: 1 }]),
    [
      body("username").optional().trim().isLength({ min: 3 }),
      body("email").optional().isEmail(),
      body("password").optional().isLength({ min: 6 }),
      body("status").optional().trim(),
      validate,
    ],
    updateProfile
  );

router.post("/refresh-token", refreshToken);

export default router;
