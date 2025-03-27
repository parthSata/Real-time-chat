// routes/chat.routes.js
import express from "express";
import { body, validationResult } from "express-validator";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { ApiError } from "../utils/ApiError.js";

const router = express.Router();

// Middleware to handle validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }
  next();
};

const initializeChatRoutes = (chatController) => {
  router.post(
    "/create",
    verifyJWT,
    [
      body("username")
        .trim()
        .isLength({ min: 1 })
        .withMessage("Username is required"),
      validate,
    ],
    (req, res, next) => chatController.createChat(req, res, next) // Use chatController.createChat
  );

  router.post(
    "/message",
    verifyJWT,
    [
      body("chatId")
        .trim()
        .isLength({ min: 1 })
        .withMessage("Chat ID is required"),
      body("content")
        .trim()
        .isLength({ min: 1 })
        .withMessage("Message content is required"),
      validate,
    ],
    (req, res, next) => chatController.sendMessage(req, res, next)
  );

  router.get(
    "/my-chats",
    verifyJWT,
    (req, res, next) => chatController.getMyChats(req, res, next) // Use chatController.getMyChats
  );

  router.get("/:chatId", verifyJWT, (req, res, next) =>
    chatController.getChatById(req, res, next)
  );

  router.get("/:chatId/messages", verifyJWT, (req, res, next) =>
    chatController.getChatMessages(req, res, next)
  );

  return router;
};

export default initializeChatRoutes;
