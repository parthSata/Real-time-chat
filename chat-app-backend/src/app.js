// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import userRouter from "./routes/user.routes.js";
import initializeChatRoutes from "./routes/chat.routes.js";
import initializeChatSocket from "./controllers/chat.controller.js";
import { ApiError } from "./utils/ApiError.js";

const app = express();
const server = http.createServer(app);

// --- CHANGE 1: Dynamic CORS Origin ---
// Use an environment variable for the CORS origin to work in both development and production.
const corsOrigin = process.env.VITE_CORS_ORIGIN || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize online users map
const onlineUsers = new Map();

// Initialize chat controller with Socket.IO and onlineUsers
const chatController = initializeChatSocket(io, onlineUsers);

// Middleware
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// --- CHANGE 2: Correct Route Order ---
// Register specific API routes BEFORE any general or welcome routes.
app.use("/api/v1/users", userRouter);
app.use("/api/v1/chats", initializeChatRoutes(chatController));

// Moved the welcome route to the root path "/" to avoid conflicts.
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Chat App API",
  });
});

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
    error:
      process.env.VITE_NODE_ENV === "development" ? err.message : undefined,
  });
});

export { app, server, io };
