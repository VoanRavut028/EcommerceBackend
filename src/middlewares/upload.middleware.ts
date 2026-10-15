import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const parseProductImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowedTypes.includes(file.mimetype)) {
      callback(new Error("Only JPEG, PNG, WebP, and AVIF images are accepted"));
      return;
    }
    callback(null, true);
  },
}).single("image");

export const uploadProductImageFile = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  parseProductImage(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message: "Image must be 5 MB or smaller",
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Invalid image upload",
    });
  });
};
