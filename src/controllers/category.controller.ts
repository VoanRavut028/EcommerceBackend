import type { Request, Response } from "express";
import mongoose from "mongoose";
import Category from "../models/categories.model.ts";
import { createCategory, getCategories } from "../services/category.service.ts";

export const createCategoryController = async (req: Request, res: Response) => {
  try {
    const { title, slug, parent, isActive } = req.body;

    const result = await createCategory(title, slug, parent, isActive);

    return res.status(result.status).json(result);
  } catch (error) {
    console.error("createCategoryController error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const listCategories = async (req: Request, res: Response) => {
  try {
    const result = await getCategories();
    return res.status(result.status).json(result);
  } catch (error) {
    console.error("listCategories controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
