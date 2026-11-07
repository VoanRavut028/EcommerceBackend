import mongoose from "mongoose";
import slugify from "slugify";
import Category from "../models/categories.model.ts";
import Product from "../models/product.model.ts";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../utils/categoryValidator.ts";

function makeSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, trim: true });
}

async function findSlugConflict(slug: string, exceptId?: string): Promise<boolean> {
  const query: Record<string, unknown> = { slug };
  if (exceptId) query._id = { $ne: exceptId };
  return Boolean(await Category.exists(query));
}

async function validateParent(
  parentId: string | null | undefined,
  categoryId?: string,
): Promise<string | null> {
  if (parentId == null) return null;
  if (!mongoose.isValidObjectId(parentId)) return "Invalid parent category id";
  if (categoryId && parentId === categoryId) {
    return "A category cannot be its own parent";
  }

  let parent = await Category.findOne({ _id: parentId, isDeleted: false }).select(
    "_id parent",
  );
  if (!parent) return "Parent category not found";

  // Prevent moving a category under one of its own descendants.
  const visited = new Set<string>();
  while (parent) {
    const currentId = parent._id.toString();
    if (categoryId && currentId === categoryId) {
      return "A category cannot be moved beneath one of its descendants";
    }
    if (visited.has(currentId)) return "The parent category tree contains a cycle";
    visited.add(currentId);
    if (!parent.parent) break;
    parent = await Category.findOne({
      _id: parent.parent,
      isDeleted: false,
    }).select("_id parent");
  }

  return null;
}

export const createCategory = async (data: CreateCategoryInput) => {
  const parentError = await validateParent(data.parent);
  if (parentError) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_PARENT",
      message: parentError,
    };
  }

  const slug = data.slug || makeSlug(data.title);
  if (!slug) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_SLUG",
      message: "Could not generate a slug from the category title",
    };
  }

  try {
    if (await findSlugConflict(slug)) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "A category with this slug already exists",
      };
    }

    const category = await Category.create({
      title: data.title,
      slug,
      parent: data.parent ?? null,
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    });

    return {
      success: true,
      status: 201,
      code: "CATEGORY_CREATED",
      message: "Category created successfully",
      data: category,
    };
  } catch (error: any) {
    if (error?.code === 11000) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "A category with this slug already exists",
      };
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return {
        success: false,
        status: 400,
        code: "CATEGORY_VALIDATION_FAILED",
        message: error.message,
      };
    }
    console.error("createCategory service error:", error);
    return {
      success: false,
      status: 500,
      code: "CATEGORY_CREATE_FAILED",
      message: "Failed to create category",
    };
  }
};

export const getCategories = async () => {
  try {
    const categories = await Category.find({ isDeleted: false })
      .sort({ title: 1 })
      .populate("parent", "title slug")
      .lean();

    return {
      success: true,
      status: 200,
      code: "CATEGORIES_FETCHED",
      data: categories,
    };
  } catch (error) {
    console.error("getCategories service error:", error);
    return {
      success: false,
      status: 500,
      code: "CATEGORIES_FETCH_FAILED",
      message: "Failed to fetch categories",
    };
  }
};

export const getCategory = async (categoryId: string) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_ID",
      message: "Invalid category id",
    };
  }

  try {
    const category = await Category.findOne({
      _id: categoryId,
      isDeleted: false,
    }).populate("parent", "title slug");

    if (!category) {
      return {
        success: false,
        status: 404,
        code: "CATEGORY_NOT_FOUND",
        message: "Category not found",
      };
    }

    return {
      success: true,
      status: 200,
      code: "CATEGORY_FETCHED",
      data: category,
    };
  } catch (error) {
    console.error("getCategory service error:", error);
    return {
      success: false,
      status: 500,
      code: "CATEGORY_FETCH_FAILED",
      message: "Failed to fetch category",
    };
  }
};

export const updateCategory = async (
  categoryId: string,
  updates: UpdateCategoryInput,
) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_ID",
      message: "Invalid category id",
    };
  }

  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_NO_UPDATES",
      message: "Provide at least one category field to update",
    };
  }

  const current = await Category.findOne({ _id: categoryId, isDeleted: false });
  if (!current) {
    return {
      success: false,
      status: 404,
      code: "CATEGORY_NOT_FOUND",
      message: "Category not found",
    };
  }

  if (updates.parent !== undefined) {
    const parentError = await validateParent(updates.parent, categoryId);
    if (parentError) {
      return {
        success: false,
        status: 400,
        code: "CATEGORY_INVALID_PARENT",
        message: parentError,
      };
    }
  }

  const slug = updates.slug ?? (updates.title ? makeSlug(updates.title) : undefined);
  if (slug !== undefined) {
    if (!slug) {
      return {
        success: false,
        status: 400,
        code: "CATEGORY_INVALID_SLUG",
        message: "Could not generate a slug from the category title",
      };
    }
    if (await findSlugConflict(slug, categoryId)) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "A category with this slug already exists",
      };
    }
  }

  try {
    if (updates.title !== undefined) current.title = updates.title;
    if (slug !== undefined) current.slug = slug;
    if (updates.parent !== undefined) {
      current.parent = updates.parent
        ? new mongoose.Types.ObjectId(updates.parent)
        : null;
    }
    if (updates.isActive !== undefined) current.isActive = updates.isActive;

    await current.save();
    return {
      success: true,
      status: 200,
      code: "CATEGORY_UPDATED",
      message: "Category updated successfully",
      data: current,
    };
  } catch (error: any) {
    if (error?.code === 11000) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "A category with this slug already exists",
      };
    }
    if (error instanceof mongoose.Error.ValidationError) {
      return {
        success: false,
        status: 400,
        code: "CATEGORY_VALIDATION_FAILED",
        message: error.message,
      };
    }
    console.error("updateCategory service error:", error);
    return {
      success: false,
      status: 500,
      code: "CATEGORY_UPDATE_FAILED",
      message: "Failed to update category",
    };
  }
};

export const deleteCategory = async (categoryId: string) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_ID",
      message: "Invalid category id",
    };
  }

  try {
    const category = await Category.findOne({ _id: categoryId, isDeleted: false });
    if (!category) {
      return {
        success: false,
        status: 404,
        code: "CATEGORY_NOT_FOUND",
        message: "Category not found",
      };
    }

    const [hasChildren, hasProducts] = await Promise.all([
      Category.exists({ parent: categoryId, isDeleted: false }),
      Product.exists({
        isDeleted: false,
        $or: [{ category: categoryId }, { categories: categoryId }],
      }),
    ]);

    if (hasChildren || hasProducts) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_IN_USE",
        message: hasChildren
          ? "Reassign or delete child categories before deleting this category"
          : "Reassign products before deleting this category",
      };
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    await category.save();

    return {
      success: true,
      status: 200,
      code: "CATEGORY_DELETED",
      message: "Category deleted successfully",
    };
  } catch (error) {
    console.error("deleteCategory service error:", error);
    return {
      success: false,
      status: 500,
      code: "CATEGORY_DELETE_FAILED",
      message: "Failed to delete category",
    };
  }
};

export const restoreCategory = async (categoryId: string) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_ID",
      message: "Invalid category id",
    };
  }

  try {
    const category = await Category.findOne({
      _id: categoryId,
      isDeleted: true,
    });
    if (!category) {
      return {
        success: false,
        status: 404,
        code: "CATEGORY_NOT_DELETED",
        message: "Deleted category not found",
      };
    }

    if (category.parent) {
      const parentExists = await Category.exists({
        _id: category.parent,
        isDeleted: false,
      });
      if (!parentExists) {
        return {
          success: false,
          status: 409,
          code: "CATEGORY_PARENT_UNAVAILABLE",
          message: "Restore or assign a valid parent category before restoring this category",
        };
      }
    }

    if (await findSlugConflict(category.slug, categoryId)) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "Another category is already using this slug",
      };
    }

    category.isDeleted = false;
    category.deletedAt = null;
    await category.save();

    return {
      success: true,
      status: 200,
      code: "CATEGORY_RESTORED",
      message: "Category restored successfully",
      data: category,
    };
  } catch (error: any) {
    if (error?.code === 11000) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "Another category is already using this slug",
      };
    }
    console.error("restoreCategory service error:", error);
    return {
      success: false,
      status: 500,
      code: "CATEGORY_RESTORE_FAILED",
      message: "Failed to restore category",
    };
  }
};
