import mongoose from "mongoose";
import Cart from "../models/cart.model.ts";
import CartItem from "../models/cartItem.model.ts";
import Product from "../models/product.model.ts";
import type {
  AddCartItemInput,
  UpdateCartItemInput,
} from "../utils/cartValidator.ts";

async function getOrCreateCart(userId: string) {
  return Cart.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function getActiveProductVariant(productId: string, variantId: string) {
  if (
    !mongoose.isValidObjectId(productId) ||
    !mongoose.isValidObjectId(variantId)
  ) {
    return { error: "Invalid product or variant id", status: 400 as const };
  }

  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    status: "active",
  });
  if (!product) {
    return { error: "Active product not found", status: 404 as const };
  }

  const variant = product.variants.find(
    (candidate) => candidate._id?.toString() === variantId,
  );
  if (!variant || !variant.isActive) {
    return { error: "Active product variant not found", status: 404 as const };
  }

  return { product, variant };
}

function invalidUserId(userId: string) {
  return !mongoose.isValidObjectId(userId);
}

export const getCart = async (userId: string) => {
  if (invalidUserId(userId)) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_USER",
      message: "Invalid authenticated user",
    };
  }

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return {
        success: true,
        status: 200,
        code: "CART_FETCHED",
        data: { items: [], subtotal: 0, total: 0 },
      };
    }

    const cartItems = await CartItem.find({ cartId: cart._id, userId }).sort({
      createdAt: 1,
    });

    const lines = await Promise.all(
      cartItems.map(async (item) => {
        const product = await Product.findById(item.productId).select(
          "title slug status isDeleted variants",
        );
        const variant = product?.variants.find(
          (candidate) =>
            candidate._id?.toString() === item.variantId.toString(),
        );
        const unitPrice = variant?.price ?? null;
        const lineTotal = unitPrice === null ? 0 : unitPrice * item.quantity;
        const isAvailable = Boolean(
          product &&
          !product.isDeleted &&
          product.status === "active" &&
          variant?.isActive &&
          variant.stock >= item.quantity,
        );

        return {
          itemId: item._id,
          product: product
            ? { id: product._id, title: product.title, slug: product.slug }
            : null,
          productId: item.productId,
          variant: variant
            ? {
                id: variant._id,
                sku: variant.sku,
                options: variant.options,
                stock: variant.stock,
                isActive: variant.isActive,
              }
            : null,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          isAvailable,
        };
      }),
    );

    const subtotal = lines
      .reduce((sum, line) => sum + line.lineTotal, 0)
      .toFixed(2);
    return {
      success: true,
      status: 200,
      code: "CART_FETCHED",
      data: {
        cartId: cart._id,
        items: lines,
        subtotal,
        total: subtotal,
      },
    };
  } catch (error) {
    console.error("getCart error:", error);
    return {
      success: false,
      status: 500,
      code: "CART_FETCH_FAILED",
      message: "Failed to fetch cart",
    };
  }
};

export const addCartItem = async (userId: string, input: AddCartItemInput) => {
  if (invalidUserId(userId)) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_USER",
      message: "Invalid authenticated user",
    };
  }

  try {
    const availability = await getActiveProductVariant(
      input.productId,
      input.variantId,
    );
    if ("error" in availability) {
      return {
        success: false,
        status: availability.status,
        code: "CART_PRODUCT_UNAVAILABLE",
        message: availability.error,
      };
    }

    const cart = await getOrCreateCart(userId);
    const existing = await CartItem.findOne({
      cartId: cart._id,
      userId,
      productId: input.productId,
      variantId: input.variantId,
    });
    const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
    if (availability.variant.stock < nextQuantity) {
      return {
        success: false,
        status: 409,
        code: "CART_INSUFFICIENT_STOCK",
        message: `Only ${availability.variant.stock} unit(s) are currently available`,
      };
    }

    if (existing) {
      existing.quantity = nextQuantity;
      await existing.save();
    } else {
      await CartItem.create({
        cartId: cart._id,
        userId: cart.userId,
        productId: availability.product._id,
        variantId: availability.variant._id!,
        quantity: input.quantity,
      });
    }

    const result = await getCart(userId);
    if (!result.success) return result;
    return {
      ...result,
      status: 200,
      code: "CART_ITEM_ADDED",
      message: "Item added to cart",
    };
  } catch (error: any) {
    if (error?.code === 11000) {
      return {
        success: false,
        status: 409,
        code: "CART_ITEM_ALREADY_EXISTS",
        message: "This item was added concurrently. Please retry the request.",
      };
    }
    console.error("addCartItem error:", error);
    return {
      success: false,
      status: 500,
      code: "CART_ITEM_ADD_FAILED",
      message: "Failed to add item to cart",
    };
  }
};

export const updateCartItem = async (
  userId: string,
  itemId: string,
  input: UpdateCartItemInput,
) => {
  if (invalidUserId(userId) || !mongoose.isValidObjectId(itemId)) {
    return {
      success: false,
      status: 400,
      code: "CART_INVALID_ID",
      message: "Invalid user or cart item id",
    };
  }

  try {
    const item = await CartItem.findOne({ _id: itemId, userId });
    if (!item) {
      return {
        success: false,
        status: 404,
        code: "CART_ITEM_NOT_FOUND",
        message: "Cart item not found",
      };
    }

    const availability = await getActiveProductVariant(
      item.productId.toString(),
      item.variantId.toString(),
    );
    if ("error" in availability) {
      return {
        success: false,
        status: availability.status,
        code: "CART_PRODUCT_UNAVAILABLE",
        message: availability.error,
      };
    }
    if (availability.variant.stock < input.quantity) {
      return {
        success: false,
        status: 409,
        code: "CART_INSUFFICIENT_STOCK",
        message: `Only ${availability.variant.stock} unit(s) are currently available`,
      };
    }

    item.quantity = input.quantity;
    await item.save();

    const result = await getCart(userId);
    if (!result.success) return result;
    return {
      ...result,
      status: 200,
      code: "CART_ITEM_UPDATED",
      message: "Cart item quantity updated",
    };
  } catch (error) {
    console.error("updateCartItem error:", error);
    return {
      success: false,
      status: 500,
      code: "CART_ITEM_UPDATE_FAILED",
      message: "Failed to update cart item",
    };
  }
};

export const removeCartItem = async (userId: string, itemId: string) => {
  if (invalidUserId(userId) || !mongoose.isValidObjectId(itemId)) {
    return {
      success: false,
      status: 400,
      code: "CART_INVALID_ID",
      message: "Invalid user or cart item id",
    };
  }

  try {
    const result = await CartItem.deleteOne({ _id: itemId, userId });
    if (result.deletedCount === 0) {
      return {
        success: false,
        status: 404,
        code: "CART_ITEM_NOT_FOUND",
        message: "Cart item not found",
      };
    }
    return getCart(userId);
  } catch (error) {
    console.error("removeCartItem error:", error);
    return {
      success: false,
      status: 500,
      code: "CART_ITEM_REMOVE_FAILED",
      message: "Failed to remove cart item",
    };
  }
};

export const clearCart = async (userId: string) => {
  if (invalidUserId(userId)) {
    return {
      success: false,
      status: 401,
      code: "AUTH_INVALID_USER",
      message: "Invalid authenticated user",
    };
  }

  try {
    const cart = await Cart.findOne({ userId });
    if (cart) await CartItem.deleteMany({ cartId: cart._id, userId });
    return {
      success: true,
      status: 200,
      code: "CART_CLEARED",
      message: "Cart cleared",
      data: { cartId: cart?._id ?? null, items: [], subtotal: 0, total: 0 },
    };
  } catch (error) {
    console.error("clearCart error:", error);
    return {
      success: false,
      status: 500,
      code: "CART_CLEAR_FAILED",
      message: "Failed to clear cart",
    };
  }
};
