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

// --- ✅ BEST PRACTICE: Define all allowed origins in an array ---
const allowedOrigins = [
  "https://real-time-chat-smoky-three.vercel.app", // Your deployed frontend
  "http://localhost:5173", // Your local development frontend
];

// --- ✅ BEST PRACTICE: Create a flexible CORS options object ---
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// --- Use the flexible CORS options for both Express and Socket.IO ---
const io = new Server(server, {
  cors: corsOptions,
});

// Middleware
app.use(cors(corsOptions)); // Use the cors options for all API routes

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Initialize chat controller and routes
const chatController = initializeChatSocket(io, new Map());
app.use("/api/v1/users", userRouter);
app.use("/api/v1/chats", initializeChatRoutes(chatController));

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
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export { app, server, io };
