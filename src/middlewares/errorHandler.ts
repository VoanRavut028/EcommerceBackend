import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(`stack error: ${err.stack}`);
  console.error(`Global Error Intercepted: ${err.message}`);

  res.status(500).json({
    success: false,
    message: "Something went wrong internally on the server.",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
};

export default errorHandler;
