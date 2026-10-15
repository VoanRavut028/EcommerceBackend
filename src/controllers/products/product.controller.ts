import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import {
  addVariant,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  listProductsAdmin,
  listProductsPublic,
  getProductBySlug,
  adjustVariantStock,
} from "../../services/products/product.service.ts";

const getRouteParam = (req: Request, name: string): string | undefined => {
  const value = req.params[name];
  return typeof value === "string" ? value : undefined;
};

 
export const createProductController = asyncHandler(
  async (req: Request, res: Response) => {
    const adminId = req.user?.sub;
    if (!adminId) {
      res.status(401).json({
        code: "AUTH_UNAUTHORIZED",
        status: 401,
        success: false,
      });
      return;
    }

    const result = await createProduct(req.body);

    res.status(result.status).json(result);
  },
);

export const addVariantController = asyncHandler(
  async (req: Request, res: Response) => {
    const productId = getRouteParam(req, "id");
    if (!productId) {
      res.status(400).json({
        code: "PRODUCT_INVALID_ID",
        message: "Invalid product id",
        status: 400,
        success: false,
      });
      return;
    }

    const result = await addVariant(productId, req.body);
    res.status(result.status).json(result);
  },
);

export const updateProductController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getRouteParam(req, "id");
    if (!id) {
      res.status(400).json({
        code: "PRODUCT_INVALID_ID",
        status: 400,
        success: false,
      });
      return;
    }

    const result = await updateProduct(id, req.body);

    res.status(result.status).json(result);
  },
);

export const deleteProductController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getRouteParam(req, "id");
    if (!id) {
      res.status(400).json({
        code: "PRODUCT_INVALID_ID",
        status: 400,
        success: false,
      });
      return;
    }

    const result = await deleteProduct(id);

    res.status(result.status).json(result);
  },
);

export const restoreProductController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getRouteParam(req, "id");
    if (!id) {
      res.status(400).json({
        code: "PRODUCT_INVALID_ID",
        status: 400,
        success: false,
      });
      return;
    }

    const result = await restoreProduct(id);

    res.status(result.status).json(result);
  },
);

export const listProductsAdminController = asyncHandler(
  async (req: Request, res: Response) => {
    const page =
      typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const category =
      typeof req.query.category === "string" ? req.query.category : undefined;
    const brand =
      typeof req.query.brand === "string" ? req.query.brand : undefined;
    const status =
      typeof req.query.status === "string" &&
      ["draft", "active", "archived"].includes(req.query.status)
        ? (req.query.status as "draft" | "active" | "archived")
        : undefined;
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const result = await listProductsAdmin({
      ...(page !== undefined ? { page } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(brand !== undefined ? { brand } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(search !== undefined ? { search } : {}),
    });

    res.status(result.status).json(result);
  },
);

export const adjustVariantStockController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getRouteParam(req, "id");
    const variantId = getRouteParam(req, "variantId");
    if (!id || !variantId) {
      res.status(400).json({
        code: "PRODUCT_INVALID_ID",
        status: 400,
        success: false,
      });
      return;
    }
    const { delta } = req.body;

    if (typeof delta !== "number" || delta === 0) {
      res.status(400).json({
        code: "PRODUCT_INVALID_DELTA",
        message: "delta must be a non-zero number",
        status: 400,
        success: false,
      });
      return;
    }

    const result = await adjustVariantStock(id, variantId, delta);

    res.status(result.status).json(result);
  },
);

 
// Public — no auth required
 

export const listProductsPublicController = asyncHandler(
  async (req: Request, res: Response) => {
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const tags =
      typeof req.query.tags === "string" ? req.query.tags.split(",") : undefined;
    const page =
      typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const category =
      typeof req.query.category === "string" ? req.query.category : undefined;
    const brand =
      typeof req.query.brand === "string" ? req.query.brand : undefined;
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const result = await listProductsPublic({
      ...(page !== undefined ? { page } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(brand !== undefined ? { brand } : {}),
      ...(search !== undefined ? { search } : {}),
      ...(minPrice !== undefined ? { minPrice } : {}),
      ...(maxPrice !== undefined ? { maxPrice } : {}),
      ...(tags !== undefined ? { tags } : {}),
    });

    res.status(result.status).json(result);
  },
);

export const getProductBySlugController = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = getRouteParam(req, "slug");
    if (!slug) {
      res.status(400).json({
        code: "PRODUCT_INVALID_SLUG",
        status: 400,
        success: false,
      });
      return;
    }

    const result = await getProductBySlug(slug);

    res.status(result.status).json(result);
  },
);
