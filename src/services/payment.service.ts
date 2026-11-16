import paywayConfig from "../configs/payway.ts";
import {
  constants,
  createHmac,
  publicEncrypt,
  timingSafeEqual,
} from "node:crypto";
import mongoose from "mongoose";
import Payment from "../models/payment.model.ts";
import Order from "../models/order.model.ts";
import { restoreOrderInventory } from "./order.service.ts";
import type { RefundPaymentInput } from "../utils/paymentValidator.ts";
import {
  generateTranId,
  generateReqTime,
  encodeItems,
  generateHash,
} from "../utils/payway.utils.ts";

interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderData {
  total: number;
  items: OrderItem[];
}

export const createPaywayPayment = async (
  order: OrderData,
  customer: Customer,
) => {
  if (
    !paywayConfig.merchantId ||
    !paywayConfig.apiKey ||
    !paywayConfig.baseUrl
  ) {
    throw new Error("ABA PayWay merchant credentials are not configured");
  }
  const tranId = generateTranId();

  const data = {
    req_time: generateReqTime(),
    merchant_id: paywayConfig.merchantId,
    tran_id: tranId,
    amount: order.total.toFixed(2),
    currency: "USD",

    firstname: customer.firstName,
    lastname: customer.lastName,
    email: customer.email,
    phone: customer.phone,

    type: "purchase",
    payment_option: "abapay",

    items: encodeItems(
      order.items.map((item) => ({
        name: item.name,
        quantity: String(item.quantity),
        price: item.price.toFixed(2),
      })),
    ),
  };

  const formData = new FormData();
  const hash = generateHash(data, paywayConfig.apiKey);
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }

  formData.append("hash", hash);
  const response = await fetch(
    `${paywayConfig.baseUrl}/api/payment-gateway/v1/payments/purchase`,
    {
      method: "POST",
      body: formData,
    },
  );

  const html = await response.text();

  if (!response.ok) {
    throw new Error(`ABA error: ${response.status}`);
  }

  return {
    tranId,
    html,
  };
};

type PayWayCallbackBody = Record<string, unknown> & {
  tran_id?: unknown;
  status?: unknown;
};

const callbackValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

function verifyCallback(
  body: PayWayCallbackBody,
  signature: string | undefined,
) {
  if (!signature || !paywayConfig.apiKey) return false;
  const payload = Object.keys(body)
    .sort()
    .map((key) => callbackValue(body[key]))
    .join("");
  const expected = createHmac("sha512", paywayConfig.apiKey)
    .update(payload, "utf8")
    .digest("base64");
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(signature.trim(), "utf8");
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

function checkTransactionHash(reqTime: string, tranId: string) {
  return createHmac("sha512", paywayConfig.apiKey)
    .update(`${reqTime}${paywayConfig.merchantId}${tranId}`, "utf8")
    .digest("base64");
}

/** Verifies the signed provider callback and checks transaction state with PayWay before updating records. */
export const handlePaywayCallback = async (
  body: unknown,
  signature?: string,
) => {
  const failure = (status: number, code: string, message: string) => ({
    success: false,
    status,
    code,
    message,
  });
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return failure(
      400,
      "PAYWAY_CALLBACK_INVALID",
      "Invalid PayWay callback body",
    );
  }
  const callback = body as PayWayCallbackBody;
  if (
    typeof callback.tran_id !== "string" ||
    callback.tran_id.length < 1 ||
    callback.tran_id.length > 20
  ) {
    return failure(
      400,
      "PAYWAY_CALLBACK_INVALID",
      "Callback is missing a valid transaction id",
    );
  }
  if (!verifyCallback(callback, signature)) {
    return failure(
      401,
      "PAYWAY_CALLBACK_SIGNATURE_INVALID",
      "Invalid PayWay callback signature",
    );
  }

  try {
    const payment = await Payment.findOne({
      providerReference: callback.tran_id,
    });
    if (!payment)
      return failure(404, "PAYMENT_NOT_FOUND", "Payment was not found");
    if (payment.status === "paid" || payment.status === "refunded") {
      return {
        success: true,
        status: 200,
        code: "PAYWAY_CALLBACK_ALREADY_HANDLED",
      };
    }

    const reqTime = generateReqTime();
    const checkResponse = await fetch(
      `${paywayConfig.baseUrl}/api/payment-gateway/v1/payments/check-transaction-2`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          req_time: reqTime,
          merchant_id: paywayConfig.merchantId,
          tran_id: payment.providerReference,
          hash: checkTransactionHash(reqTime, payment.providerReference),
        }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!checkResponse.ok) throw new Error("PayWay transaction check failed");
    const checked = (await checkResponse.json()) as Record<string, any>;
    if (String(checked.status?.code ?? "") !== "00")
      throw new Error("PayWay did not confirm transaction");
    const checkedTranId =
      checked.status?.tran_id ??
      checked.data?.tran_id ??
      checked.data?.transaction_id;
    const transaction = checked.data ?? checked;
    if (
      checkedTranId !== undefined &&
      String(checkedTranId) !== payment.providerReference
    ) {
      throw new Error("PayWay transaction id mismatch");
    }
    const paymentCode = Number(transaction.payment_status_code);
    if (paymentCode !== 0) {
      const statusText = String(transaction.payment_status ?? "").toUpperCase();
      if (statusText !== "DECLINED" && statusText !== "FAILED") {
        return { success: true, status: 200, code: "PAYWAY_PAYMENT_PENDING" };
      }
      payment.status = "failed";
      await payment.save();
      await Order.updateOne(
        { _id: payment.orderId, paymentStatus: "pending" },
        { $set: { paymentStatus: "failed" } },
      );
      return { success: true, status: 200, code: "PAYWAY_PAYMENT_DECLINED" };
    }
    const amountMinor = (value: unknown) =>
      Math.round((Number(value) + Number.EPSILON) * 100);
    if (
      amountMinor(transaction.original_amount ?? transaction.total_amount) !==
        amountMinor(payment.amount) ||
      String(
        transaction.original_currency ??
          transaction.payment_currency ??
          transaction.currency ??
          "",
      ).toUpperCase() !== payment.currency
    ) {
      throw new Error("PayWay payment amount or currency mismatch");
    }

    let latePayment = false;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const currentPayment = await Payment.findOne({
          _id: payment._id,
          status: { $in: ["pending", "failed"] },
        }).session(session);
        if (!currentPayment) return;
        const order = await Order.findById(currentPayment.orderId).session(
          session,
        );
        if (!order) throw new Error("Order for PayWay payment was not found");
        latePayment =
          order.status !== "pending" || Boolean(order.inventoryReleasedAt);
        currentPayment.status = "paid";
        currentPayment.paidAt = new Date();
        currentPayment.reconciliationRequired = latePayment;
        await currentPayment.save({ session });
        order.paymentStatus = "paid";
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return {
      success: true,
      status: 200,
      code: latePayment
        ? "PAYWAY_LATE_PAYMENT_REQUIRES_RECONCILIATION"
        : "PAYWAY_PAYMENT_CONFIRMED",
      ...(latePayment
        ? {
            message:
              "Payment arrived after the order reservation was released; do not fulfill until reconciled",
          }
        : {}),
    };
  } catch (error: any) {
    if (
      error?.code === 20 ||
      String(error?.message ?? "").includes(
        "Transaction numbers are only allowed",
      )
    ) {
      return failure(
        503,
        "DATABASE_TRANSACTIONS_REQUIRED",
        "MongoDB replica set transactions are required; callback changes were not committed",
      );
    }
    console.error("PayWay callback handling failed:", error);
    return failure(
      503,
      "PAYWAY_CALLBACK_RETRY",
      "Could not verify the PayWay payment; callback may be retried",
    );
  }
};

/** Refunds a confirmed PayWay payment; inventory is restored only for canceled/returned orders. */
export const refundPaywayPayment = async (
  paymentId: string,
  input: RefundPaymentInput,
) => {
  const failure = (status: number, code: string, message: string) => ({
    success: false,
    status,
    code,
    message,
  });
  if (!mongoose.isValidObjectId(paymentId))
    return failure(400, "PAYMENT_ID_INVALID", "Invalid payment id");
  if (
    !paywayConfig.merchantId ||
    !paywayConfig.apiKey ||
    !paywayConfig.refundPublicKey
  ) {
    return failure(
      503,
      "PAYWAY_REFUND_CONFIGURATION_REQUIRED",
      "PayWay refund credentials are not configured",
    );
  }

  const payment = await Payment.findById(paymentId);
  if (!payment)
    return failure(404, "PAYMENT_NOT_FOUND", "Payment was not found");
  if (payment.status !== "paid" && payment.status !== "partially_refunded") {
    return failure(
      409,
      "PAYMENT_NOT_REFUNDABLE",
      "Only confirmed paid payments can be refunded",
    );
  }
  if (
    !payment.paidAt ||
    Date.now() - payment.paidAt.getTime() > 30 * 24 * 60 * 60 * 1000
  ) {
    return failure(
      409,
      "PAYMENT_REFUND_WINDOW_EXPIRED",
      "PayWay refunds must be requested within 30 days of payment",
    );
  }
  const toMinor = (amount: number) =>
    payment.currency === "KHR"
      ? Math.round(amount)
      : Math.round((amount + Number.EPSILON) * 100);
  const order = await Order.findById(payment.orderId);
  if (
    !order ||
    order.paymentStatus !== "paid" ||
    !Number.isFinite(order.total) ||
    toMinor(order.total) !== toMinor(payment.amount)
  ) {
    return failure(
      409,
      "PAYMENT_ORDER_NOT_REFUNDABLE",
      "The linked order is missing or is not marked paid",
    );
  }

  const remainingMinor =
    toMinor(payment.amount) - toMinor(payment.refundedAmount);
  const requestedMinor =
    input.amount === undefined ? remainingMinor : toMinor(input.amount);
  if (
    requestedMinor <= 0 ||
    requestedMinor > remainingMinor ||
    (payment.currency === "KHR" &&
      input.amount !== undefined &&
      !Number.isInteger(input.amount))
  ) {
    return failure(
      400,
      "PAYMENT_REFUND_AMOUNT_INVALID",
      "Refund amount must be positive and no greater than the remaining balance",
    );
  }
  const refundAmount =
    payment.currency === "KHR" ? requestedMinor : requestedMinor / 100;

  const reserved = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: { $in: ["paid", "partially_refunded"] },
      refundInProgress: { $ne: true },
      refundedAmount: payment.refundedAmount,
    },
    { $set: { refundInProgress: true, pendingRefundAmount: refundAmount } },
    { new: true },
  );
  if (!reserved)
    return failure(
      409,
      "PAYMENT_REFUND_IN_PROGRESS",
      "A refund is already being processed for this payment",
    );

  const requestTime = generateReqTime();
  const refundData = JSON.stringify({
    mc_id: paywayConfig.merchantId,
    tran_id: payment.providerReference,
    refund_amount:
      payment.currency === "KHR"
        ? String(refundAmount)
        : refundAmount.toFixed(2),
  });
  let merchantAuth: string;
  try {
    merchantAuth = publicEncrypt(
      {
        key: paywayConfig.refundPublicKey,
        padding: constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(refundData, "utf8"),
    ).toString("hex");
  } catch {
    await Payment.updateOne(
      { _id: payment._id, refundInProgress: true },
      { $set: { refundInProgress: false, pendingRefundAmount: null } },
    );
    return failure(
      503,
      "PAYWAY_REFUND_KEY_INVALID",
      "PayWay refund RSA key is invalid",
    );
  }
  const hash = createHmac("sha512", paywayConfig.apiKey)
    .update(`${requestTime}${paywayConfig.merchantId}${merchantAuth}`, "utf8")
    .digest("base64");

  let response: Response;
  try {
    response = await fetch(
      `${paywayConfig.baseUrl}/api/merchant-portal/merchant-access/online-transaction/refund`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_time: requestTime,
          merchant_id: paywayConfig.merchantId,
          merchant_auth: merchantAuth,
          hash,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    await Payment.updateOne(
      { _id: payment._id, refundInProgress: true },
      { $set: { reconciliationRequired: true } },
    );
    return failure(
      503,
      "PAYWAY_REFUND_OUTCOME_UNKNOWN",
      "Refund outcome is unknown; payment is locked for reconciliation to prevent a duplicate refund",
    );
  }

  let providerResult: Record<string, any>;
  try {
    providerResult = (await response.json()) as Record<string, any>;
  } catch {
    await Payment.updateOne(
      { _id: payment._id, refundInProgress: true },
      { $set: { reconciliationRequired: true } },
    );
    return failure(
      503,
      "PAYWAY_REFUND_OUTCOME_UNKNOWN",
      "PayWay response was unreadable; payment is locked for reconciliation",
    );
  }
  if (!response.ok || String(providerResult.status?.code ?? "") !== "00") {
    await Payment.updateOne(
      { _id: payment._id, refundInProgress: true },
      { $set: { refundInProgress: false, pendingRefundAmount: null } },
    );
    return failure(
      502,
      "PAYWAY_REFUND_REJECTED",
      "ABA PayWay did not confirm the refund",
    );
  }

  const totalRefunded = Number(providerResult.total_refunded);
  const grandTotal = Number(providerResult.grand_total);
  if (
    !Number.isFinite(totalRefunded) ||
    !Number.isFinite(grandTotal) ||
    (providerResult.currency &&
      String(providerResult.currency).toUpperCase() !== payment.currency) ||
    toMinor(totalRefunded) < toMinor(payment.refundedAmount) + requestedMinor ||
    toMinor(totalRefunded) > toMinor(payment.amount) ||
    toMinor(grandTotal) !== toMinor(payment.amount)
  ) {
    await Payment.updateOne(
      { _id: payment._id, refundInProgress: true },
      { $set: { reconciliationRequired: true } },
    );
    return failure(
      503,
      "PAYWAY_REFUND_RESPONSE_MISMATCH",
      "PayWay refund response requires manual reconciliation",
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const currentPayment = await Payment.findOne({
        _id: payment._id,
        refundInProgress: true,
      }).session(session);
      if (!currentPayment) throw new Error("Refund reservation was lost");
      const currentOrder = await Order.findById(currentPayment.orderId).session(
        session,
      );
      if (!currentOrder) throw new Error("Refund order was not found");
      currentPayment.refundedAmount = totalRefunded;
      const fullyRefunded =
        toMinor(totalRefunded) >= toMinor(currentPayment.amount);
      currentPayment.status = fullyRefunded ? "refunded" : "partially_refunded";
      currentPayment.refundedAt = new Date();
      currentPayment.refundInProgress = false;
      currentPayment.pendingRefundAmount = null;
      currentPayment.reconciliationRequired = false;
      await currentPayment.save({ session });
      if (fullyRefunded) {
        currentOrder.paymentStatus = "refunded";
        if (currentOrder.status === "pending") {
          await restoreOrderInventory(currentOrder, session);
          currentOrder.status = "cancelled";
        }
        await currentOrder.save({ session });
      }
    });
    const updatedPayment = await Payment.findById(payment._id).lean();
    return {
      success: true,
      status: 200,
      code:
        updatedPayment?.status === "refunded"
          ? "PAYMENT_REFUNDED"
          : "PAYMENT_PARTIALLY_REFUNDED",
      data: updatedPayment,
    };
  } catch (error: any) {
    await Payment.updateOne(
      { _id: payment._id, refundInProgress: true },
      { $set: { reconciliationRequired: true } },
    );
    if (
      error?.code === 20 ||
      String(error?.message ?? "").includes(
        "Transaction numbers are only allowed",
      )
    ) {
      return failure(
        503,
        "DATABASE_TRANSACTIONS_REQUIRED",
        "Provider refund succeeded; MongoDB transaction support is required to update the order and inventory",
      );
    }
    console.error("PayWay refund reconciliation failed:", error);
    return failure(
      503,
      "PAYWAY_REFUND_RECONCILIATION_REQUIRED",
      "Provider refund succeeded but local state needs reconciliation",
    );
  } finally {
    await session.endSession();
  }
};
