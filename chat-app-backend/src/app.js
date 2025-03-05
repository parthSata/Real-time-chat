// app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// Configure CORS with a specific origin
app.use(
  cors({
    origin: "http://localhost:5173", // Match your frontend URL (Vite default port)
    credentials: true, // Allow credentials (cookies, tokens)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);

// Middleware
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter);

// Error handling middleware (optional, uncomment if needed)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export { app };