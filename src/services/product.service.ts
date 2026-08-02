import type { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/product.model.ts";
import type { IVariant, IColor } from "../models/product.model.ts";
export const addProduct = async (
  title: string,
  description: string,
  category: string,
  brand: string,
  colors: Array<IColor>,
  variants: Array<IVariant>,
): Promise<any> => {
  try {
    if (!title || !description || !category || !brand) {
      return {
        success: false,
        status: 400,
        message: "title, description, category, and brand are required",
      };
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return {
        success: false,
        status: 400,
        message: "Invalid category id",
      };
    }

    if (!Array.isArray(colors) || colors.length === 0) {
      return {
        success: false,
        status: 400,
        message: "At least one color is required",
      };
    }

    for (const color of colors as IColor[]) {
      if (!color.name || typeof color.name !== "string") {
        return {
          success: false,
          status: 400,
          message: "Each color must have a valid name",
        };
      }
      if (!Array.isArray(color.images) || color.images.length === 0) {
        return {
          success: false,
          status: 400,
          message: `Color "${color.name}" must have at least one image`,
        };
      }
      for (const image of color.images) {
        if (!image.url) {
          return {
            success: false,
            status: 400,
            message: `Each image for color "${color.name}" must have a url`,
          };
        }
      }
    }

    const colorNames = (colors as IColor[]).map((c) => c.name);

    if (!Array.isArray(variants) || variants.length === 0) {
      return {
        success: false,
        status: 400,
        message: "At least one variant is required",
      };
    }

    const skuSet = new Set<string>();

    for (const variant of variants as IVariant[]) {
      const { sku, color, size, price, stock } = variant;

      if (!sku || !color || !size || price == null || stock == null) {
        return {
          success: false,
          status: 400,
          message: "Each variant requires sku, color, size, price, and stock",
        };
      }

      if (!colorNames.includes(color)) {
        return {
          success: false,
          status: 400,
          message: `Variant color "${color}" does not match any defined color`,
        };
      }

      if (skuSet.has(sku)) {
        return {
          success: false,
          status: 400,
          message: `Duplicate SKU "${sku}" found in submitted variants`,
        };
      }
      skuSet.add(sku);

      if (price < 0 || stock < 0) {
        return {
          success: false,
          status: 400,
          message: "Price and stock must be non-negative",
        };
      }
    }

    const existingSkuProduct = await Product.findOne({
      "variants.sku": { $in: Array.from(skuSet) },
    }).select("_id variants.sku");

    if (existingSkuProduct) {
      return {
        success: false,
        status: 409,
        message: "One or more SKUs already exist in the database",
      };
    }

    const product = await Product.create({
      title,
      description,
      category,
      brand,
      colors,
      variants,
    });

    return {
      success: true,
      status: 201,
      message: "Product created successfully",
      data: product,
    };
  } catch (error: any) {
    if (error instanceof mongoose.Error.ValidationError) {
      return {
        success: false,
        status: 400,
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      };
    }

    if (error?.code === 11000) {
      return {
        success: false,
        status: 400,
        message: "Duplicate key error",
        keyValue: error.keyValue,
      };
    }

    console.error("addProduct error:", error);
    return {
      success: false,
      status: 500,
      message: "Internal server error",
    };
  }
};

export const getProducts = async (page: number, limit: number): Promise<any> => {
  try {
    const safePage = Math.max(Math.trunc(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 10, 1), 50);
    const skip = (safePage - 1) * safeLimit;
 
    const filter = {
      isDeleted: false,
    };
 
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Product.countDocuments(filter),
    ]);
 
    const totalPages = Math.ceil(total / safeLimit);
 
    return {
      success: true,
      status: 200,
      message: "Products fetched successfully",
      data: products,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  } catch (error) {
    console.error("getProducts service error:", error);
    return {
      success: false,
      status: 500,
      message: "Internal server error",
    };
  }
};