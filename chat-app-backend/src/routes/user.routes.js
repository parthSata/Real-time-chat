import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
} from "../controllers/user.controller.js"; // Check this path
import { upload } from "../middlewares/multer.middleware.js"; // Check this path
const router = express.Router();

router
  .route("/register")
  .post(upload.fields([{ name: "profilePic", maxCount: 1 }]), registerUser);

router.route("/login").post(loginUser);
router.route("/logout").post(logoutUser);
// routes/user.routes.js
router.get("/me", verifyJWT, (req, res) =>
  res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"))
);
export default router;
