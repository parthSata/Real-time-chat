// routes/chat.routes.js
import express from "express";
import {verifyJWT} from "../middlewares/auth.middleware.js";

const router = express.Router();

const initializeChatRoutes = (chatController) => {
  router.post("/create", verifyJWT, (req, res) => chatController.createChat(req, res));
  router.post("/message", verifyJWT, (req, res) =>
    chatController.sendMessage(req, res)
  );
  router.get("/my-chats", verifyJWT, (req, res) =>
    chatController.getUserChats(req, res)
  );

  return router;
};

export default initializeChatRoutes;