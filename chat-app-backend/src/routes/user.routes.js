import express from "express";
import { registerUser, loginUser } from "../controllers/user.controller.js"; // Check this path
import {upload} from "../middlewares/multer.middleware.js"; // Check this path
const router = express.Router();

router
  .route("/register")
  .post(upload.fields([{ name: "profilePic", maxCount: 1 }]), registerUser);

router.route("/login").post(loginUser);

export default router;
