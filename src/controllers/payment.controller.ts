import type { Request, Response } from "express";
import mongoose from "mongoose";
import { createPaywayPayment } from "../services/payment.service.ts";
import Order from "../models/order.model.ts";
import OrderItem from "../models/orderItem.model.ts";
import Payment from "../models/payment.model.ts";
import User from "../models/user.model.ts";

export const createPayment = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub;
    const { orderId } = req.body as { orderId?: unknown };

    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    if (typeof orderId !== "string" || !mongoose.isValidObjectId(orderId)) {
      res.status(400).json({ success: false, message: "A valid orderId is required" });
      return;
    }

    // Scope the lookup to the authenticated owner so one user cannot pay another user's order.
    const order = await Order.findOne({
      _id: orderId,
      userId,
      status: "pending",
      paymentStatus: { $in: ["pending", "failed"] },
    });
    if (!order) {
      res.status(404).json({ success: false, message: "Payable order not found" });
      return;
    }
    if (!Number.isFinite(order.total) || order.total <= 0) {
      res.status(400).json({ success: false, message: "Order total must be greater than zero" });
      return;
    }

    const existingPayment = await Payment.findOne({ orderId: order._id, status: "pending" });
    if (existingPayment) {
      res.status(409).json({ success: false, message: "A payment is already pending for this order" });
      return;
    }

    const [user, orderItems] = await Promise.all([
      User.findById(userId).select("first_name last_name email phone_number"),
      OrderItem.find({ orderId: order._id }).sort({ createdAt: 1 }),
    ]);
    if (!user) {
      res.status(401).json({ success: false, message: "Authenticated user was not found" });
      return;
    }
    if (orderItems.length === 0) {
      res.status(400).json({ success: false, message: "Order has no items" });
      return;
    }

    const phone = user.phone_number || order.shippingAddress.phoneNumber;
    const payment = await createPaywayPayment(
      {
        total: order.total,
        items: orderItems.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
      },
      {
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone,
      },
    );

    await Payment.create({
      orderId: order._id,
      userId: order.userId,
      payment_option: "abapay",
      providerReference: payment.tranId,
      amount: order.total,
      currency: "USD",
      status: "pending",
    });

    res.status(200).type("html").send(payment.html);
  } catch (error) {
    console.error("ABA payment session creation failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create payment",
    });
  }
};
