// chat.routes.js
import express from "express";
import { body, param, validationResult } from "express-validator";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadInCloudinary } from "../utils/cloudinary.js"; // You will need to create this utility function

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }
  next();
};

const initializeChatRoutes = ({ triggerPusherEvent }) => {
  // Route to send a new message
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
    async (req, res, next) => {
      try {
        const { chatId, content } = req.body;
        const sender = req.user;

        // In a real app, you would save the message to your database first.
        // const message = await Message.create({ chatId, content, sender: sender._id });

        // Trigger the Pusher event to send the message to all listening clients
        await triggerPusherEvent(`chat-${chatId}`, "new-message", {
          chatId,
          content,
          sender: {
            _id: sender._id,
            username: sender.username,
          },
          timestamp: new Date(),
        });

        return res.status(200).json({
          success: true,
          message: "Message sent successfully!",
          data: {
            chatId,
            content,
            sender: sender._id,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // You would also update any other routes that need real-time updates
  // For example, when a user joins a group chat or a message is deleted.

  // The route to upload media, now updated with Cloudinary logic
  router.post(
    "/:chatId/upload-media",
    verifyJWT,
    upload.single("media"), // Using multer's memoryStorage middleware
    [
      param("chatId")
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      validate,
    ],
    async (req, res, next) => {
      try {
        const { chatId } = req.params;
        const sender = req.user;
        const mediaFile = req.file;

        if (!mediaFile) {
          return next(new ApiError(400, "No media file provided"));
        }

        // Upload the file directly from memory to Cloudinary
        const cloudinaryResponse = await uploadInCloudinary(mediaFile);

        if (!cloudinaryResponse || !cloudinaryResponse.url) {
          return next(
            new ApiError(500, "Failed to upload media to Cloudinary")
          );
        }

        // In a real app, you would save this URL to your message in the database.
        // const message = await Message.create({ chatId, content: cloudinaryResponse.url, sender: sender._id });

        // Trigger a Pusher event with the URL
        await triggerPusherEvent(`chat-${chatId}`, "new-media-message", {
          chatId,
          mediaUrl: cloudinaryResponse.url,
          mediaType: cloudinaryResponse.resource_type,
          sender: {
            _id: sender._id,
            username: sender.username,
          },
          timestamp: new Date(),
        });

        return res.status(200).json({
          success: true,
          message: "Media uploaded and message sent successfully!",
          data: {
            chatId,
            mediaUrl: cloudinaryResponse.url,
            sender: sender._id,
          },
        });
      } catch (error) {
        console.error("Media upload error:", error);
        next(new ApiError(500, "Something went wrong during media upload"));
      }
    }
  );

  // Other routes remain the same as they were before
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
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
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
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
  );

  router.post(
    "/remove-user",
    verifyJWT,
    [
      body("chatId").isMongoId().withMessage("Valid chat ID required"),
      body("userIdToRemove").isMongoId().withMessage("Valid user ID required"),
      validate,
    ],
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
  );

  router.get("/my-chats", verifyJWT, (req, res, next) => {
    res.status(501).json({ success: false, message: "Not Implemented" });
  });

  router.get(
    "/:chatId",
    verifyJWT,
    [
      param("chatId")
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      validate,
    ],
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
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
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
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
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
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
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
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
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
  );

  router.post(
    "/:chatId/initiate-video-call",
    verifyJWT,
    [
      param("chatId")
        .isMongoId()
        .withMessage("Chat ID must be a valid MongoDB ObjectId"),
      validate,
    ],
    (req, res, next) => {
      res.status(501).json({ success: false, message: "Not Implemented" });
    }
  );

  return router;
};

export default initializeChatRoutes;
