import mongoose from "mongoose";
import Product from "../../models/product.model.ts";
import type { IImage, IProduct } from "../../models/product.model.ts";
import Category from "../../models/categories.model.ts";
import type {
  CreateProductInput,
  UpdateProductInput,
  VariantInput,
} from "../../utils/productValidator.ts";

const EDITABLE_FIELDS = [
  "title",
  "description",
  "shortDescription",
  "category",
  "categories",
  "brand",
  "attributes",
  "images",
  "variants",
  "status",
  "metaTitle",
  "metaDescription",
  "tags",
  "isDigital",
  "requiresShipping",
] as const;

function toModelImages(
  images:
    | Array<{
        url: string;
        public_id?: string | undefined;
        alt?: string | undefined;
        isPrimary?: boolean | undefined;
      }>
    | undefined,
): IImage[] {
  return (images ?? []).map((image) => ({
    url: image.url,
    ...(image.public_id !== undefined ? { public_id: image.public_id } : {}),
    ...(image.alt !== undefined ? { alt: image.alt } : {}),
    ...(image.isPrimary !== undefined ? { isPrimary: image.isPrimary } : {}),
  }));
}

// Validation helpers

function validateVariants(variants: VariantInput[]): string | null {
  if (!Array.isArray(variants) || variants.length === 0) {
    return "Product must have at least one variant";
  }

  const seenSkus = new Set<string>();
  const seenOptionKeys = new Set<string>();

  for (const v of variants) {
    if (!v.sku || typeof v.sku !== "string") {
      return "Each variant requires a sku";
    }
    const sku = v.sku.trim().toUpperCase();
    if (seenSkus.has(sku)) {
      return `Duplicate sku "${sku}" within this product`;
    }
    seenSkus.add(sku);

    if (typeof v.price !== "number" || v.price < 0) {
      return `Variant ${v.sku} has an invalid price`;
    }
    if (typeof v.stock !== "number" || v.stock < 0) {
      return `Variant ${v.sku} has an invalid stock value`;
    }
    if (v.compareAtPrice != null && v.compareAtPrice < 0) {
      return `Variant ${v.sku} has an invalid compareAtPrice`;
    }

    
    if (v.options) {
      const key = Object.entries(v.options)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => `${k}:${val}`)
        .join("|");
      if (key) {
        if (seenOptionKeys.has(key)) {
          return `Duplicate option combination (${key}) within this product`;
        }
        seenOptionKeys.add(key);
      }
    }
  }

  return null;
}

function variantOptionsKey(options: Map<string, string> | Record<string, string>) {
  const entries = options instanceof Map ? [...options.entries()] : Object.entries(options);
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

async function assertCategoryExists(categoryId: string) {
  if (!mongoose.isValidObjectId(categoryId)) {
    return "Invalid category id";
  }
  const exists = await Category.exists({ _id: categoryId });
  if (!exists) {
    return "Category does not exist";
  }
  return null;
}

// Create validate helper

export const createProduct = async (data: CreateProductInput) => {
  const { title, description, category, variants } = data;

  if (!title || !description || !category) {
    return {
      code: "PRODUCT_MISSING_FIELDS",
      message: "title, description, and category are required",
      status: 400,
      success: false,
    };
  }

  const variantError = validateVariants(variants);
  if (variantError) {
    return {
      code: "PRODUCT_INVALID_VARIANTS",
      message: variantError,
      status: 400,
      success: false,
    };
  }

  const categoryError = await assertCategoryExists(category);
  if (categoryError) {
    return {
      code: "PRODUCT_INVALID_CATEGORY",
      message: categoryError,
      status: 400,
      success: false,
    };
  }

  try {
     
    const skus = variants.map((v) => v.sku.trim().toUpperCase());
    const clash = await Product.findOne({ "variants.sku": { $in: skus } });
    if (clash) {
      return {
        code: "PRODUCT_SKU_EXISTS",
        message: "One or more variant SKUs are already in use",
        status: 409,
        success: false,
      };
    }

    
    const productData: Partial<IProduct> = {
      title: data.title,
      description: data.description,
      ...(data.shortDescription !== undefined
        ? { shortDescription: data.shortDescription }
        : {}),
      category: new mongoose.Types.ObjectId(data.category),
      categories: (data.categories ?? []).map(
        (categoryId) => new mongoose.Types.ObjectId(categoryId),
      ),
      ...(data.brand !== undefined ? { brand: data.brand } : {}),
      attributes: data.attributes ?? [],
      images: toModelImages(data.images),
      variants: data.variants.map((variant) => ({
        sku: variant.sku,
        options: new Map(Object.entries(variant.options ?? {})),
        price: variant.price,
        stock: variant.stock,
        images: toModelImages(variant.images),
        isActive: variant.isActive ?? true,
        ...(variant.compareAtPrice !== undefined
          ? { compareAtPrice: variant.compareAtPrice }
          : {}),
        ...(variant.barcode !== undefined ? { barcode: variant.barcode } : {}),
        ...(variant.weight !== undefined ? { weight: variant.weight } : {}),
      })),
      status: data.status ?? "draft",
      ...(data.metaTitle !== undefined ? { metaTitle: data.metaTitle } : {}),
      ...(data.metaDescription !== undefined
        ? { metaDescription: data.metaDescription }
        : {}),
      tags: data.tags ?? [],
      isDigital: data.isDigital ?? false,
      requiresShipping: data.requiresShipping ?? true,
    };

    const product = await Product.create(productData);

    return {
      code: "PRODUCT_CREATED",
      message: "Product created",
      status: 201,
      success: true,
      product,
    };
  } catch (err: any) {
    console.error("createProduct error:", err);
    if (err.code === 11000) {
      return {
        code: "PRODUCT_SKU_EXISTS",
        message: "One or more variant SKUs are already in use",
        status: 409,
        success: false,
      };
    }
    if (err.name === "ValidationError") {
      return {
        code: "PRODUCT_INVALID_VALUE",
        message: err.message,
        status: 400,
        success: false,
      };
    }
    return {
      code: "PRODUCT_CREATE_FAILED",
      message: "Failed to create product",
      status: 500,
      success: false,
    };
  }
};

export const addVariant = async (productId: string, variant: VariantInput) => {
  if (!mongoose.isValidObjectId(productId)) {
    return {
      code: "PRODUCT_INVALID_ID",
      message: "Invalid product id",
      status: 400,
      success: false,
    };
  }

  const variantError = validateVariants([variant]);
  if (variantError) {
    return {
      code: "PRODUCT_INVALID_VARIANT",
      message: variantError,
      status: 400,
      success: false,
    };
  }

  try {
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
      return {
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        status: 404,
        success: false,
      };
    }

    const normalizedSku = variant.sku.trim().toUpperCase();
    const skuExists = await Product.exists({ "variants.sku": normalizedSku });
    if (skuExists) {
      return {
        code: "PRODUCT_SKU_EXISTS",
        message: `SKU "${normalizedSku}" is already in use`,
        status: 409,
        success: false,
      };
    }

    const newOptionsKey = variantOptionsKey(variant.options ?? {});
    if (
      newOptionsKey &&
      product.variants.some(
        (existing) => variantOptionsKey(existing.options) === newOptionsKey,
      )
    ) {
      return {
        code: "PRODUCT_VARIANT_EXISTS",
        message: "A variant with the same option combination already exists",
        status: 409,
        success: false,
      };
    }

    product.variants.push({
      sku: normalizedSku,
      options: new Map(Object.entries(variant.options ?? {})),
      price: variant.price,
      stock: variant.stock,
      images: toModelImages(variant.images),
      isActive: variant.isActive ?? true,
      ...(variant.compareAtPrice !== undefined
        ? { compareAtPrice: variant.compareAtPrice }
        : {}),
      ...(variant.barcode !== undefined ? { barcode: variant.barcode } : {}),
      ...(variant.weight !== undefined ? { weight: variant.weight } : {}),
    });

    await product.save();
    const addedVariant = product.variants[product.variants.length - 1];

    return {
      code: "PRODUCT_VARIANT_ADDED",
      message: "Variant added",
      status: 201,
      success: true,
      variant: addedVariant,
    };
  } catch (err: any) {
    console.error("addVariant error:", err);
    if (err.code === 11000) {
      return {
        code: "PRODUCT_SKU_EXISTS",
        message: "SKU is already in use",
        status: 409,
        success: false,
      };
    }
    if (err.name === "ValidationError") {
      return {
        code: "PRODUCT_INVALID_VARIANT",
        message: err.message,
        status: 400,
        success: false,
      };
    }
    return {
      code: "PRODUCT_VARIANT_ADD_FAILED",
      message: "Failed to add variant",
      status: 500,
      success: false,
    };
  }
};

// Update

export const updateProduct = async (
  productId: string,
  updates: UpdateProductInput,
) => {
  if (!mongoose.isValidObjectId(productId)) {
    return {
      code: "PRODUCT_INVALID_ID",
      message: "Invalid product id",
      status: 400,
      success: false,
    };
  }

  // Whitelist — never spread req.body. slug/minPrice/maxPrice/isDeleted/
  // deletedAt are intentionally excluded: they are server-owned.
  const safeUpdates: Record<string, any> = {};
  for (const field of EDITABLE_FIELDS) {
    if (updates[field] !== undefined) safeUpdates[field] = updates[field];
  }

  if (Object.keys(safeUpdates).length === 0) {
    return {
      code: "PRODUCT_NO_UPDATES",
      message: "No valid fields to update",
      status: 400,
      success: false,
    };
  }

  if (safeUpdates.variants) {
    const variantError = validateVariants(
      safeUpdates.variants as VariantInput[],
    );
    if (variantError) {
      return {
        code: "PRODUCT_INVALID_VARIANTS",
        message: variantError,
        status: 400,
        success: false,
      };
    }
  }

  if (safeUpdates.category) {
    const categoryError = await assertCategoryExists(
      safeUpdates.category as string,
    );
    if (categoryError) {
      return {
        code: "PRODUCT_INVALID_CATEGORY",
        message: categoryError,
        status: 400,
        success: false,
      };
    }
  }

  try {
 
    const product = await Product.findOne({ _id: productId, isDeleted: false });

    if (!product) {
      return {
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        status: 404,
        success: false,
      };
    }

    if (safeUpdates.variants) {
      const skus = (safeUpdates.variants as VariantInput[]).map((v) =>
        v.sku.trim().toUpperCase(),
      );
      const clash = await Product.findOne({
        _id: { $ne: productId },
        "variants.sku": { $in: skus },
      });
      if (clash) {
        return {
          code: "PRODUCT_SKU_EXISTS",
          message:
            "One or more variant SKUs are already in use by another product",
          status: 409,
          success: false,
        };
      }
    }

    Object.assign(product, safeUpdates);
    await product.save();

    return {
      code: "PRODUCT_UPDATED",
      message: "Product updated",
      status: 200,
      success: true,
      product,
    };
  } catch (err: any) {
    console.error("updateProduct error:", err);
    if (err.code === 11000) {
      return {
        code: "PRODUCT_SKU_EXISTS",
        message: "One or more variant SKUs are already in use",
        status: 409,
        success: false,
      };
    }
    if (err.name === "ValidationError") {
      return {
        code: "PRODUCT_INVALID_VALUE",
        message: err.message,
        status: 400,
        success: false,
      };
    }
    return {
      code: "PRODUCT_UPDATE_FAILED",
      message: "Failed to update product",
      status: 500,
      success: false,
    };
  }
};

// Delete (soft) / Restore

export const deleteProduct = async (productId: string) => {
  if (!mongoose.isValidObjectId(productId)) {
    return {
      code: "PRODUCT_INVALID_ID",
      message: "Invalid product id",
      status: 400,
      success: false,
    };
  }

  try {
  
    const product = await Product.findOneAndUpdate(
      { _id: productId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );

    if (!product) {
      return {
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        status: 404,
        success: false,
      };
    }

    return {
      code: "PRODUCT_DELETED",
      message: "Product deleted",
      status: 200,
      success: true,
    };
  } catch (err) {
    console.error("deleteProduct error:", err);
    return {
      code: "PRODUCT_DELETE_FAILED",
      message: "Failed to delete product",
      status: 500,
      success: false,
    };
  }
};

export const restoreProduct = async (productId: string) => {
  if (!mongoose.isValidObjectId(productId)) {
    return {
      code: "PRODUCT_INVALID_ID",
      message: "Invalid product id",
      status: 400,
      success: false,
    };
  }

  try {
    const product = await Product.findOneAndUpdate(
      { _id: productId, isDeleted: true },
      { isDeleted: false, deletedAt: null },
      { new: true },
    );

    if (!product) {
      return {
        code: "PRODUCT_NOT_FOUND",
        message: "Deleted product not found",
        status: 404,
        success: false,
      };
    }

    return {
      code: "PRODUCT_RESTORED",
      message: "Product restored",
      status: 200,
      success: true,
      product,
    };
  } catch (err) {
    console.error("restoreProduct error:", err);
    return {
      code: "PRODUCT_RESTORE_FAILED",
      message: "Failed to restore product",
      status: 500,
      success: false,
    };
  }
};


// Read — admin (sees draft/archived) & public (active only)

type ListFilters = {
  page?: number;
  limit?: number;
  category?: string;
  brand?: string;
  status?: "draft" | "active" | "archived";
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  search?: string;
};

export const listProductsAdmin = async (filters: ListFilters) => {
  try {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { isDeleted: false };
    if (filters.category) query.category = filters.category;
    if (filters.brand) query.brand = filters.brand;
    if (filters.status) query.status = filters.status;
    if (filters.search) query.$text = { $search: filters.search };

    const [products, totalItems] = await Promise.all([
      Product.find(query)
        .sort(
          filters.search
            ? { score: { $meta: "textScore" } }
            : { createdAt: -1 },
        )
        .skip(skip)
        .limit(limit)
        .populate("category", "name slug"),
      Product.countDocuments(query),
    ]);

    return {
      code: "PRODUCTS_FETCHED",
      status: 200,
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  } catch (err) {
    console.error("listProductsAdmin error:", err);
    return {
      code: "PRODUCTS_FETCH_FAILED",
      message: "Failed to fetch products",
      status: 500,
      success: false,
    };
  }
};

export const listProductsPublic = async (filters: ListFilters) => {
  try {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;
    const skip = (page - 1) * limit;

    // Public listing is always scoped to active, non-deleted products —
    // status/isDeleted are never accepted from client query params here.
    const query: Record<string, any> = { isDeleted: false, status: "active" };
    if (filters.category) query.category = filters.category;
    if (filters.brand) query.brand = filters.brand;
    if (filters.tags?.length) query.tags = { $in: filters.tags };
    if (filters.search) query.$text = { $search: filters.search };
    if (filters.minPrice != null || filters.maxPrice != null) {
      query.minPrice = {};
      if (filters.minPrice != null) query.minPrice.$gte = filters.minPrice;
      if (filters.maxPrice != null) query.minPrice.$lte = filters.maxPrice;
    }

    const [products, totalItems] = await Promise.all([
      Product.find(query)
        .select("-metaTitle -metaDescription")
        .sort(
          filters.search
            ? { score: { $meta: "textScore" } }
            : { createdAt: -1 },
        )
        .skip(skip)
        .limit(limit)
        .populate("category", "name slug"),
      Product.countDocuments(query),
    ]);

    return {
      code: "PRODUCTS_FETCHED",
      status: 200,
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  } catch (err) {
    console.error("listProductsPublic error:", err);
    return {
      code: "PRODUCTS_FETCH_FAILED",
      message: "Failed to fetch products",
      status: 500,
      success: false,
    };
  }
};

export const getProductBySlug = async (slug: string) => {
  try {
    const product = await Product.findOne({
      slug,
      isDeleted: false,
      status: "active",
    }).populate("category", "name slug");

    if (!product) {
      return {
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
        status: 404,
        success: false,
      };
    }

    return {
      code: "PRODUCT_FETCHED",
      status: 200,
      success: true,
      product,
    };
  } catch (err) {
    console.error("getProductBySlug error:", err);
    return {
      code: "PRODUCT_FETCH_FAILED",
      message: "Failed to fetch product",
      status: 500,
      success: false,
    };
  }
};


export const adjustVariantStock = async (
  productId: string,
  variantId: string,
  delta: number,
) => {
  if (
    !mongoose.isValidObjectId(productId) ||
    !mongoose.isValidObjectId(variantId)
  ) {
    return {
      code: "PRODUCT_INVALID_ID",
      message: "Invalid product or variant id",
      status: 400,
      success: false,
    };
  }

  try {
    const filter: Record<string, any> = {
      _id: productId,
      isDeleted: false,
      "variants._id": variantId,
    };
    // When decrementing, require enough stock exists so the update simply
    // matches zero documents instead of going negative.
    if (delta < 0) {
      filter["variants.$.stock"] = { $gte: Math.abs(delta) };
    }

    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { "variants.$.stock": delta } },
      { new: true },
    );

    if (!product) {
      return {
        code: "PRODUCT_STOCK_ADJUST_FAILED",
        message: "Variant not found or insufficient stock",
        status: 409,
        success: false,
      };
    }

    return {
      code: "PRODUCT_STOCK_ADJUSTED",
      status: 200,
      success: true,
      product,
    };
  } catch (err) {
    console.error("adjustVariantStock error:", err);
    return {
      code: "PRODUCT_STOCK_ADJUST_FAILED",
      message: "Failed to adjust stock",
      status: 500,
      success: false,
    };
  }
};
