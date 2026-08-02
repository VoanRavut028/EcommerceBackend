import { string } from "zod";
import Category from "../models/categories.model.ts";
import mongoose from "mongoose";
export const createCategory = async (
  title: string,
  slug: string | undefined,
  parent: string | null,
  isActive?: boolean,
): Promise<any> => {
  try {
    if (!title) {
      return {
        success: false,
        status: 400,
        message: "title is required",
      };
    }

    if (parent) {
      if (!mongoose.isValidObjectId(parent)) {
        return {
          success: false,
          status: 400,
          message: "Invalid parent category id",
        };
      }

      const parentCategory = await Category.findOne({
        _id: parent,
        isDeleted: false,
      });

      if (!parentCategory) {
        return {
          success: false,
          status: 404,
          message: "Parent category not found",
        };
      }
    }

    const createPayload: any = {
      title,
      slug: slug ?? "",
      parent: parent || null,
    };

    if (isActive !== undefined) {
      createPayload.isActive = isActive;
    }

    const category = await Category.create(createPayload);

    return {
      success: true,
      status: 201,
      message: "Category created successfully",
      data: category,
    };
  } catch (error: any) {
    if (error?.code === 11000) {
      const dupField = Object.keys(error.keyValue || {})[0] || "field";
      const dupValue = error.keyValue?.[dupField];
      return {
        success: false,
        status: 409,
        message: `A category with ${dupField} "${dupValue}" already exists`,
      };
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return {
        success: false,
        status: 400,
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      };
    }

    console.error("createCategory service error:", error);
    return {
      success: false,
      status: 500,
      message: "Internal server error",
    };
  }
};

export const getCategories = async (): Promise<any> => {
  try {
    const categories = await Category.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .populate("parent", "title slug")
      .lean();

    return {
      success: true,
      status: 200,
      message: "Categories fetched successfully",
      data: categories,
    };
  } catch (error) {
    console.error("getCategories service error:", error);
    return {
      success: false,
      status: 500,
      message: "Internal server error",
    };
  }
};
