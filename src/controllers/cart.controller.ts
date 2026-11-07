import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../services/cart.service.ts";

function authenticatedUserId(req: Request): string | undefined {
  return req.user?.sub;
}

export const getCartController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const result = await getCart(userId);
    res.status(result.status ?? 500).json(result);
  },
);

export const addCartItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const result = await addCartItem(userId, req.body);
    res.status(result.status ?? 500).json(result);
  },
);

export const updateCartItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = authenticatedUserId(req);
    const itemId = req.params.itemId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    if (typeof itemId !== "string") {
      res.status(400).json({ success: false, message: "Invalid cart item id" });
      return;
    }
    const result = await updateCartItem(userId, itemId, req.body);
    res.status(result.status ?? 500).json(result);
  },
);

export const removeCartItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = authenticatedUserId(req);
    const itemId = req.params.itemId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    if (typeof itemId !== "string") {
      res.status(400).json({ success: false, message: "Invalid cart item id" });
      return;
    }
    const result = await removeCartItem(userId, itemId);
    res.status(result.status).json(result);
  },
);

export const clearCartController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = authenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const result = await clearCart(userId);
    res.status(result.status).json(result);
  },
);
