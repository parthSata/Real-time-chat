// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import initializeChatSocket from "./controllers/chat.controller.js";
import userRouter from "./routes/user.routes.js";
import initializeChatRoutes from "./routes/chat.routes.js";
import { ApiError } from "./utils/ApiError.js";
import {
  setupBothOnlineSocket,
  setupChatSocket,
  setupOnlineSocket,
} from "./sockets/index.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize online users map
const onlineUsers = new Map();

// Set up additional socket functionalities
setupOnlineSocket(io, onlineUsers);
setupChatSocket(io, onlineUsers);
setupBothOnlineSocket(io, onlineUsers);

// Initialize chat controller with Socket.IO and onlineUsers
const chatController = initializeChatSocket(io, onlineUsers);
if (!chatController || typeof chatController.createChat !== "function") {
  throw new Error("chatController is not properly initialized");
}

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/chats", initializeChatRoutes(chatController));

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
      errors: err.errors,
      data: err.data,
    });
  }
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export { app, server };
