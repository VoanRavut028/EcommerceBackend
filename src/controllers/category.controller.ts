import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { CATEGORY_TYPES, type CategoryType } from "../models/categories.model.ts";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  restoreCategory,
  updateCategory,
} from "../services/category.service.ts";

const routeId = (req: Request): string | undefined => {
  const id = req.params.id;
  return typeof id === "string" ? id : undefined;
};

export const createCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await createCategory(req.body);
    res.status(result.status).json(result);
  },
);

export const getCategoriesController = asyncHandler(
  async (req: Request, res: Response) => {
    const requestedType = req.query.type;
    if (
      requestedType !== undefined &&
      (typeof requestedType !== "string" ||
        !CATEGORY_TYPES.includes(requestedType as CategoryType))
    ) {
      res.status(400).json({
        success: false,
        code: "CATEGORY_INVALID_TYPE",
        message: `type must be one of: ${CATEGORY_TYPES.join(", ")}`,
      });
      return;
    }

    const result = await getCategories(requestedType as CategoryType | undefined);
    res.status(result.status).json(result);
  },
);

export const getCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = req.params.slug;
    const requestedType = req.query.type;
    if (typeof slug !== "string" || !slug.trim()) {
      res.status(400).json({
        success: false,
        code: "CATEGORY_INVALID_SLUG",
        message: "Invalid category slug",
      });
      return;
    }
    if (
      typeof requestedType !== "string" ||
      !CATEGORY_TYPES.includes(requestedType as CategoryType)
    ) {
      res.status(400).json({
        success: false,
        code: "CATEGORY_INVALID_TYPE",
        message: `A valid type query parameter is required: ${CATEGORY_TYPES.join(", ")}`,
      });
      return;
    }
    const result = await getCategory(slug, requestedType as CategoryType);
    res.status(result.status).json(result);
  },
);

export const updateCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = routeId(req);
    if (!id) {
      res.status(400).json({
        success: false,
        code: "CATEGORY_INVALID_ID",
        message: "Invalid category id",
      });
      return;
    }
    const result = await updateCategory(id, req.body);
    res.status(result.status).json(result);
  },
);

export const deleteCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = routeId(req);
    if (!id) {
      res.status(400).json({
        success: false,
        code: "CATEGORY_INVALID_ID",
        message: "Invalid category id",
      });
      return;
    }
    const result = await deleteCategory(id);
    res.status(result.status).json(result);
  },
);

export const restoreCategoryController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = routeId(req);
    if (!id) {
      res.status(400).json({
        success: false,
        code: "CATEGORY_INVALID_ID",
        message: "Invalid category id",
      });
      return;
    }
    const result = await restoreCategory(id);
    res.status(result.status).json(result);
  },
);

// Backwards-compatible export for any older imports.
export const listCategories = getCategoriesController;
