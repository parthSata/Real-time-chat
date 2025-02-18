import express from "express";
import cors from "cors";


const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN, //This is use to accept all request from url
    credentials: true,
  })
);

export { app };
