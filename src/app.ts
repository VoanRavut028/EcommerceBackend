import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookiesParser from "cookie-parser";
import passport from "./configs/passport.ts";
import authRouter from "./routes/auth.route.ts";
import categoryRouter from "./routes/category.route.ts";
import errorHandler from "./middlewares/errorHandler.ts";
import resetPasswordRouter from "./routes/resetPassword.route.ts";
import productRouter from "./routes/products/product.route.ts";
import publicProductRouter from "./routes/products/productPublic.route.ts";
import cartRouter from "./routes/cart.route.ts";
import addressRouter from "./routes/address.route.ts";
import orderRouter from "./routes/order.route.ts";
import paymentRouter from "./routes/payment.route.ts";
const app = express();
app.use(cookiesParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL as string,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(passport.initialize());

app.use(morgan("dev"));

app.use("/api/v1", authRouter);
app.use("/api/v1", categoryRouter);
app.use("/api/v1", resetPasswordRouter);
app.use("/api/v1", publicProductRouter);
app.use("/api/v1", addressRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/v1", orderRouter);
app.use("/api/v1", paymentRouter);
app.use("/api/v1", productRouter);
app.use("/api/v1", cartRouter);
app.use(errorHandler);

export default app;
