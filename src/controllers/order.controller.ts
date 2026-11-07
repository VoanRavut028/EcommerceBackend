import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import {
  cancelOrder,
  checkout,
  getOrder,
  listOrders,
  updateOrderStatus,
} from "../services/order.service.ts";

function currentUser(req: Request) {
  return { id: req.user?.sub, role: req.user?.role };
}

export const checkoutController = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  if (!user.id) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  const result = await checkout(user.id, req.body);
  res.status(result.status).json(result);
});

export const listOrdersController = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  if (!user.id || !user.role) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  const result = await listOrders(user.id, user.role === "admin");
  res.status(result.status).json(result);
});

export const getOrderController = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const orderId = req.params.id;
  if (!user.id || !user.role) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  if (typeof orderId !== "string") {
    res.status(400).json({ success: false, message: "Invalid order id" });
    return;
  }
  const result = await getOrder(user.id, user.role === "admin", orderId);
  res.status(result.status).json(result);
});

export const updateOrderStatusController = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id;
  if (typeof orderId !== "string") {
    res.status(400).json({ success: false, message: "Invalid order id" });
    return;
  }
  const result = await updateOrderStatus(orderId, req.body.status);
  res.status(result.status).json(result);
});

export const cancelOrderController = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const orderId = req.params.id;
  if (!user.id) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  if (typeof orderId !== "string") {
    res.status(400).json({ success: false, message: "Invalid order id" });
    return;
  }
  const result = await cancelOrder(user.id, orderId);
  res.status(result.status).json(result);
});
