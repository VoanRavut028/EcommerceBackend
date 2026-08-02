import type { Request, Response } from "express";
import { addProduct, getProducts } from "../services/product.service.ts";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { title, description, category, brand, colors, variants } = req.body;

    const result = await addProduct(
      title,
      description,
      category,
      brand,
      colors,
      variants,
    );

    return res.status(result.status).json(result);
  } catch (error) {
    console.error("createProduct controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const listProducts = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await getProducts(page, limit);

    return res.status(result.status).json(result);
  } catch (error) {
    console.error("listProducts controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
