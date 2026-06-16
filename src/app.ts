import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookiesParser from "cookie-parser";
import passport from "./configs/passport.ts";
import authRouter from "./routes/auth.route.ts";

import type { Request, Response, NextFunction } from "express";
const app = express();
app.use(cookiesParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL as string,
    credentials: true,
  }),
);
app.use(passport.initialize());

app.use(morgan("dev"));

app.use("/api/v1", authRouter);
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error(`stack error: ${err.stack}`);
  console.error(`Global Error Intercepted:  ${err.message}`);
  res.status(500).json({
    success: false,
    message: "Something went wrong internally on the server.",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});
export default app;
