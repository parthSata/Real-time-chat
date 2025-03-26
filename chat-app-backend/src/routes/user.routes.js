import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
} from "../controllers/user.controller.js"; // Check this path
import { upload } from "../middlewares/multer.middleware.js"; // Check this path
import { verifyJWT } from "../middlewares/auth.middleware.js"; // Check this path
const router = express.Router();

router
  .route("/register")
  .post(upload.fields([{ name: "profilePic", maxCount: 1 }]), registerUser);

router.route("/login").post(loginUser);
router.route("/logout").post(logoutUser);
router.get("/me", verifyJWT, getCurrentUser);


export default router;
