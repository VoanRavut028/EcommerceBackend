import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { uploadProductImage } from "../../services/upload/cloudinary.service.ts";

export const uploadProductImageController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Select an image using the multipart field named "image"',
      });
      return;
    }

    const result = await uploadProductImage(req.file.buffer);
    res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      },
    });
  },
);
