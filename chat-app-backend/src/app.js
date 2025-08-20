// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
// All Socket.IO imports have been removed.
import userRouter from "./routes/user.routes.js";
import initializeChatRoutes from "./routes/chat.routes.js";
import { ApiError } from "./utils/ApiError.js";
// Importing the Pusher trigger function from your pusher.js file
import { triggerPusherEvent } from "./utils/Pusher.js";

const app = express();
const server = http.createServer(app);

// Get the CORS origin from the environment variables.
// Use your specific Vercel URL in production, or localhost for development.
const corsOrigin = process.env.VITE_CORS_ORIGIN || "http://localhost:5173";
console.log("🚀 ~ corsOrigin:", corsOrigin);

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

// Routes
app.use("/api/v1/users", userRouter);

// Initialize chat routes by passing the Pusher trigger function
app.use("/api/v1/chats", initializeChatRoutes({ triggerPusherEvent }));

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

export { app, server };
