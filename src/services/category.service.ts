import mongoose from "mongoose";
import slugify from "slugify";
import Category from "../models/categories.model.ts";
import type { CategoryType } from "../models/categories.model.ts";
import Product from "../models/product.model.ts";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../utils/categoryValidator.ts";

function makeSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, trim: true });
}

async function findSlugConflict(
  slug: string,
  type: CategoryType,
  exceptId?: string,
): Promise<boolean> {
  // Slugs are unique within a type, including soft-deleted categories.
  const query: Record<string, unknown> = { slug, type };
  if (exceptId) query._id = { $ne: exceptId };
  return Boolean(await Category.exists(query));
}

async function validateParent(
  parentId: string | null | undefined,
  categoryId?: string,
  categoryType?: CategoryType,
): Promise<string | null> {
  if (parentId == null) return null;
  if (!mongoose.isValidObjectId(parentId)) return "Invalid parent category id";
  if (categoryId && parentId === categoryId) {
    return "A category cannot be its own parent";
  }

  let parent = await Category.findOne({ _id: parentId, isDeleted: false }).select(
    "_id parent type",
  );
  if (!parent) return "Parent category not found";
  if (categoryType && parent.type && parent.type !== categoryType) {
    return "A child category must use the same type as its parent";
  }

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
    }).select("_id parent type");
  }

  return null;
}

export const createCategory = async (data: CreateCategoryInput) => {
  const parentCategory = data.parent
    ? await Category.findOne({ _id: data.parent, isDeleted: false }).select("_id type")
    : null;

  if (data.parent && !parentCategory) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_PARENT",
      message: "Parent category not found",
    };
  }

  const categoryType = data.type ?? parentCategory?.type;
  if (!categoryType) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_TYPE_REQUIRED",
      message: "A top-level category must specify a type",
    };
  }

  const parentError = await validateParent(data.parent, undefined, categoryType);
  if (parentError) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_PARENT",
      message: parentError,
    };
  }

  // Normalize here as well as in request validation so direct service calls
  // cannot bypass canonical, case-insensitive slug conflict checks.
  const slug = makeSlug(data.slug ?? data.title);
  if (!slug) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_SLUG",
      message: "Could not generate a slug from the category title",
    };
  }

  try {
    if (await findSlugConflict(slug, categoryType)) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "A category with this slug already exists for this type",
      };
    }

    const category = await Category.create({
      title: data.title,
      slug,
      parent: data.parent ?? null,
      type: categoryType,
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
        message: "A category with this slug already exists for this type",
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

export const getCategories = async (type?: CategoryType) => {
  try {
    // Public catalog reads must not expose disabled or soft-deleted categories.
    const categories = await Category.find({
      isDeleted: false,
      isActive: true,
      ...(type ? { type } : {}),
    })
      .sort({ title: 1 })
      .populate({
        path: "parent",
        select: "title slug type",
        match: { isDeleted: false, isActive: true },
      })
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

export const getCategory = async (slug: string, type: CategoryType) => {
  try {
    const category = await Category.findOne({
      slug: slug.toLowerCase().trim(),
      type,
      isDeleted: false,
      isActive: true,
    }).populate({
      path: "parent",
      select: "title slug type",
      match: { isDeleted: false, isActive: true },
    });

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

  const nextType = updates.type ?? current.type;
  const nextParent = updates.parent !== undefined
    ? updates.parent
    : current.parent?.toString() ?? null;

  if (updates.type !== undefined && updates.type !== current.type) {
    const hasMismatchedChildren = await Category.exists({
      parent: categoryId,
      isDeleted: false,
      type: { $exists: true, $ne: updates.type },
    });
    if (hasMismatchedChildren) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_TYPE_HAS_CHILDREN",
        message: "Update child categories before changing this category type",
      };
    }
  }

  if (updates.parent !== undefined || updates.type !== undefined) {
    const parentError = await validateParent(nextParent, categoryId, nextType);
    if (parentError) {
      return {
        success: false,
        status: 400,
        code: "CATEGORY_INVALID_PARENT",
        message: parentError,
      };
    }
  }

  const requestedSlug = updates.slug ?? (updates.title ? makeSlug(updates.title) : undefined);
  const slug = requestedSlug === undefined ? undefined : makeSlug(requestedSlug);
  if (slug !== undefined && !slug) {
    return {
      success: false,
      status: 400,
      code: "CATEGORY_INVALID_SLUG",
      message: "Could not generate a slug from the category title",
    };
  }
  const slugForType = slug ?? current.slug;
  if (slug !== undefined || updates.type !== undefined) {
    if (await findSlugConflict(slugForType, nextType, categoryId)) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "A category with this slug already exists for this type",
      };
    }
  }

  try {
    if (updates.title !== undefined) current.title = updates.title;
    if (slug !== undefined) current.slug = slug;
    if (updates.type !== undefined) current.type = updates.type;
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
        message: "A category with this slug already exists for this type",
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
      const parent = await Category.findOne({
        _id: category.parent,
        isDeleted: false,
      }).select("type");
      if (!parent) {
        return {
          success: false,
          status: 409,
          code: "CATEGORY_PARENT_UNAVAILABLE",
          message: "Restore or assign a valid parent category before restoring this category",
        };
      }
      if (parent.type && category.type && parent.type !== category.type) {
        return {
          success: false,
          status: 409,
          code: "CATEGORY_PARENT_TYPE_MISMATCH",
          message: "The category type must match its parent before restoring it",
        };
      }
    }

    if (await findSlugConflict(category.slug, category.type, categoryId)) {
      return {
        success: false,
        status: 409,
        code: "CATEGORY_SLUG_EXISTS",
        message: "Another category is already using this slug for this type",
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
        message: "Another category is already using this slug for this type",
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
