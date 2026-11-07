import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Address from "../models/address.model.ts";
import Cart from "../models/cart.model.ts";
import CartItem from "../models/cartItem.model.ts";
import Order, { type OrderStatus } from "../models/order.model.ts";
import OrderItem from "../models/orderItem.model.ts";
import Product from "../models/product.model.ts";
import type { CheckoutInput } from "../utils/orderValidator.ts";

class OrderServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

const validTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

function serviceError(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (error instanceof OrderServiceError) {
    return {
      success: false,
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }
  const databaseError = error as { code?: number; message?: string };
  if (
    databaseError?.code === 20 ||
    databaseError?.message?.includes("Transaction numbers are only allowed")
  ) {
    return {
      success: false,
      status: 503,
      code: "DATABASE_TRANSACTIONS_REQUIRED",
      message: "MongoDB replica set transactions are required; no changes were committed",
    };
  }
  console.error(`${fallbackCode}:`, error);
  return {
    success: false,
    status: 500,
    code: fallbackCode,
    message: fallbackMessage,
  };
}

function invalidObjectId(id: string) {
  return !mongoose.isValidObjectId(id);
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function orderNumber() {
  return `ORD-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function restoreInventory(
  orderId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession,
) {
  const items = await OrderItem.find({ orderId }).session(session);
  for (const item of items) {
    await Product.updateOne(
      {
        _id: item.productId,
        variants: { $elemMatch: { _id: item.variantId } },
      },
      { $inc: { "variants.$.stock": item.quantity } },
      { session },
    );
  }
}

export const checkout = async (userId: string, input: CheckoutInput) => {
  if (invalidObjectId(userId)) {
    return { success: false, status: 401, code: "AUTH_INVALID_USER", message: "Invalid authenticated user" };
  }
  if (invalidObjectId(input.addressId)) {
    return { success: false, status: 400, code: "ADDRESS_INVALID_ID", message: "Invalid address id" };
  }

  const session = await mongoose.startSession();
  try {
    let createdOrderId: mongoose.Types.ObjectId | undefined;
    await session.withTransaction(async () => {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      const address = await Address.findOne({ _id: input.addressId, userId: userObjectId }).session(session);
      if (!address) throw new OrderServiceError("Address not found", 404, "ADDRESS_NOT_FOUND");

      const cart = await Cart.findOne({ userId: userObjectId }).session(session);
      if (!cart) throw new OrderServiceError("Cart is empty", 400, "CART_EMPTY");
      const cartItems = await CartItem.find({ cartId: cart._id, userId: userObjectId })
        .sort({ createdAt: 1 })
        .session(session);
      if (cartItems.length === 0) throw new OrderServiceError("Cart is empty", 400, "CART_EMPTY");

      const itemSnapshots: Array<{
        productId: mongoose.Types.ObjectId;
        variantId: mongoose.Types.ObjectId;
        productName: string;
        sku: string;
        options: Record<string, string>;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
      }> = [];
      let subtotalCents = 0;

      for (const cartItem of cartItems) {
        const product = await Product.findOne({
          _id: cartItem.productId,
          status: "active",
          isDeleted: false,
        }).session(session);
        const variant = product?.variants.find(
          (entry) => entry._id?.toString() === cartItem.variantId.toString(),
        );
        const variantId = variant?._id;
        if (!product || !variant || !variantId || !variant.isActive) {
          throw new OrderServiceError(
            "One or more cart items are no longer available",
            409,
            "CHECKOUT_PRODUCT_UNAVAILABLE",
          );
        }

        const stockUpdate = await Product.updateOne(
          {
            _id: product._id,
            status: "active",
            isDeleted: false,
            variants: {
              $elemMatch: {
                _id: variantId,
                isActive: true,
                stock: { $gte: cartItem.quantity },
              },
            },
          },
          { $inc: { "variants.$.stock": -cartItem.quantity } },
          { session },
        );
        if (stockUpdate.modifiedCount !== 1) {
          throw new OrderServiceError(
            `Insufficient stock for ${product.title} (${variant.sku})`,
            409,
            "CHECKOUT_INSUFFICIENT_STOCK",
          );
        }

        const unitPrice = money(variant.price);
        const lineTotal = money(unitPrice * cartItem.quantity);
        subtotalCents += Math.round(lineTotal * 100);
        itemSnapshots.push({
          productId: product._id,
          variantId,
          productName: product.title,
          sku: variant.sku,
          options: Object.fromEntries(variant.options ?? new Map()),
          unitPrice,
          quantity: cartItem.quantity,
          lineTotal,
        });
      }

      const subtotal = subtotalCents / 100;
      // Tax and shipping remain zero until the project has configured pricing rules.
      const [order] = await Order.create(
        [{
          orderNumber: orderNumber(),
          userId: userObjectId,
          shippingAddress: {
            label: address.label,
            fullName: address.fullName,
            phoneNumber: address.phoneNumber,
            street: address.street,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country,
          },
          subtotal,
          tax: 0,
          shipping: 0,
          total: subtotal,
          paymentStatus: "pending",
          status: "pending",
        }],
        { session },
      );
      if (!order) throw new Error("Order creation failed");

      await OrderItem.insertMany(
        itemSnapshots.map((item) => ({ ...item, orderId: order._id })),
        { session },
      );
      await CartItem.deleteMany({ cartId: cart._id, userId: userObjectId }, { session });
      createdOrderId = order._id;
    });

    if (!createdOrderId) throw new Error("Order transaction completed without an order");
    const [order, items] = await Promise.all([
      Order.findById(createdOrderId).lean(),
      OrderItem.find({ orderId: createdOrderId }).sort({ createdAt: 1 }).lean(),
    ]);
    return { success: true, status: 201, code: "ORDER_CREATED", data: { order, items } };
  } catch (error) {
    return serviceError(error, "CHECKOUT_FAILED", "Checkout failed; no order was placed");
  } finally {
    await session.endSession();
  }
};

export const listOrders = async (userId: string, isAdmin: boolean) => {
  if (invalidObjectId(userId)) return { success: false, status: 401, code: "AUTH_INVALID_USER", message: "Invalid authenticated user" };
  try {
    const query = isAdmin ? {} : { userId: new mongoose.Types.ObjectId(userId) };
    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
    const orderIds = orders.map((order) => order._id);
    const items = await OrderItem.find({ orderId: { $in: orderIds } }).sort({ createdAt: 1 }).lean();
    const itemsByOrder = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.orderId.toString();
      const bucket = itemsByOrder.get(key) ?? [];
      bucket.push(item);
      itemsByOrder.set(key, bucket);
    }
    return {
      success: true,
      status: 200,
      code: "ORDERS_FETCHED",
      data: orders.map((order) => ({ ...order, items: itemsByOrder.get(order._id.toString()) ?? [] })),
    };
  } catch (error) {
    return serviceError(error, "ORDERS_FETCH_FAILED", "Failed to fetch orders");
  }
};

export const getOrder = async (userId: string, isAdmin: boolean, orderId: string) => {
  if (invalidObjectId(userId) || invalidObjectId(orderId)) {
    return { success: false, status: 400, code: "ORDER_INVALID_ID", message: "Invalid order id" };
  }
  try {
    const query = isAdmin
      ? { _id: orderId }
      : { _id: orderId, userId: new mongoose.Types.ObjectId(userId) };
    const order = await Order.findOne(query).lean();
    if (!order) return { success: false, status: 404, code: "ORDER_NOT_FOUND", message: "Order not found" };
    const items = await OrderItem.find({ orderId: order._id }).sort({ createdAt: 1 }).lean();
    return { success: true, status: 200, code: "ORDER_FETCHED", data: { ...order, items } };
  } catch (error) {
    return serviceError(error, "ORDER_FETCH_FAILED", "Failed to fetch order");
  }
};

export const updateOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
  if (invalidObjectId(orderId)) return { success: false, status: 400, code: "ORDER_INVALID_ID", message: "Invalid order id" };
  const session = await mongoose.startSession();
  try {
    let didUpdate = false;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new OrderServiceError("Order not found", 404, "ORDER_NOT_FOUND");
      if (nextStatus === "processing" && order.paymentStatus !== "paid") {
        throw new OrderServiceError(
          "Order must be paid before fulfillment can begin",
          409,
          "ORDER_PAYMENT_REQUIRED",
        );
      }
      if (order.status === nextStatus) return;
      if (!validTransitions[order.status].includes(nextStatus)) {
        throw new OrderServiceError(
          `Cannot change order status from ${order.status} to ${nextStatus}`,
          409,
          "ORDER_INVALID_STATUS_TRANSITION",
        );
      }
      if (nextStatus === "cancelled" && order.paymentStatus === "paid") {
        throw new OrderServiceError(
          "Refund the paid order before cancelling it",
          409,
          "ORDER_REFUND_REQUIRED",
        );
      }
      if (nextStatus === "cancelled") await restoreInventory(order._id, session);
      order.status = nextStatus;
      await order.save({ session });
      didUpdate = true;
    });
    const order = await Order.findById(orderId).lean();
    return { success: true, status: 200, code: didUpdate ? "ORDER_STATUS_UPDATED" : "ORDER_FETCHED", data: order };
  } catch (error) {
    return serviceError(error, "ORDER_STATUS_UPDATE_FAILED", "Failed to update order status");
  } finally {
    await session.endSession();
  }
};

export const cancelOrder = async (userId: string, orderId: string) => {
  if (invalidObjectId(userId) || invalidObjectId(orderId)) {
    return { success: false, status: 400, code: "ORDER_INVALID_ID", message: "Invalid order id" };
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, userId }).session(session);
      if (!order) throw new OrderServiceError("Order not found", 404, "ORDER_NOT_FOUND");
      if (order.status !== "pending") {
        throw new OrderServiceError("Only pending orders can be cancelled", 409, "ORDER_CANNOT_BE_CANCELLED");
      }
      if (order.paymentStatus === "paid") {
        throw new OrderServiceError(
          "A paid order must be refunded before it can be cancelled",
          409,
          "ORDER_REFUND_REQUIRED",
        );
      }
      await restoreInventory(order._id, session);
      order.status = "cancelled";
      await order.save({ session });
    });
    const order = await Order.findById(orderId).lean();
    return { success: true, status: 200, code: "ORDER_CANCELLED", data: order };
  } catch (error) {
    return serviceError(error, "ORDER_CANCEL_FAILED", "Failed to cancel order");
  } finally {
    await session.endSession();
  }
};
