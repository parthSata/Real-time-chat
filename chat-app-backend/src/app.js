import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN, //This is use to accept all request from url
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: `16kb` }));
app.use(express.static("public"));
app.use(cookieParser());

// Add error handling middleware at the end
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// routes
import userRouter from "./routes/user.routes.js";

// routes decalration
app.use("/api/v1/users", userRouter);

export { app };
