import express from "express";
import { body, param, validationResult } from "express-validator";
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
    (req, res, next) => chatController.createChat(req, res, next)
  );

  router.post(
    "/create-group",
    verifyJWT,
    [
      body("groupName")
        .trim()
        .isLength({ min: 1 })
        .withMessage("Group name is required"),
      body("participantUsernames")
        .isArray({ min: 1 })
        .withMessage("At least one participant required"),
      validate,
    ],
    (req, res, next) => chatController.createGroupChat(req, res, next)
  );

  router.post(
    "/remove-user",
    verifyJWT,
    [
      body("chatId").isMongoId().withMessage("Valid chat ID required"),
      body("userIdToRemove").isMongoId().withMessage("Valid user ID required"),
      validate,
    ],
    (req, res, next) => chatController.removeUserFromGroup(req, res, next)
  );

  router.post(
    "/message",
    verifyJWT,
    [
      body("chatId")
        .trim()
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      body("content")
        .trim()
        .isLength({ min: 1 })
        .withMessage("Message content is required"),
      validate,
    ],
    (req, res, next) => chatController.sendMessage(req, res, next)
  );

  router.get("/my-chats", verifyJWT, (req, res, next) =>
    chatController.getMyChats(req, res, next)
  );

  router.get(
    "/:chatId",
    verifyJWT,
    [
      param("chatId")
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      validate,
    ],
    (req, res, next) => chatController.getChatById(req, res, next)
  );

  router.get(
    "/:chatId/messages",
    verifyJWT,
    [
      param("chatId")
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      validate,
    ],
    (req, res, next) => chatController.getChatMessages(req, res, next)
  );

  router.delete(
    "/:chatId",
    verifyJWT,
    [
      param("chatId")
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      validate,
    ],
    (req, res, next) => chatController.deleteChat(req, res, next)
  );

  router.delete(
    "/:chatId/messages",
    verifyJWT,
    [
      param("chatId")
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      body("messageIds")
        .isArray({ min: 1 })
        .withMessage("Message IDs must be a non-empty array"),
      validate,
    ],
    (req, res, next) => chatController.deleteMessages(req, res, next)
  );

  router.post(
    "/message/read",
    verifyJWT,
    [
      body("messageId")
        .trim()
        .isMongoId()
        .withMessage("Message ID must be valid"),
      validate,
    ],
    (req, res, next) => chatController.markMessageAsRead(req, res, next)
  );

  return router;
};

export default initializeChatRoutes;
