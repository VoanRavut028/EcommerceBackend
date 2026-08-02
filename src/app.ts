import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookiesParser from "cookie-parser";
import passport from "./configs/passport.ts";
import authRouter from "./routes/auth.route.ts";
import productRoute from "./routes/product.route.ts";
import categoryRouter from "./routes/category.route.ts";
import errorHandler from "./middlewares/errorHandler.ts";

const app = express();
app.use(cookiesParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL as string,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(passport.initialize());

app.use(morgan("dev"));

app.use("/api/v1", authRouter);
app.use("/api/v1", productRoute);
app.use("/api/v1", categoryRouter);
app.use(errorHandler);

export default app;
