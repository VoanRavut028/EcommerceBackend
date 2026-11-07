import { z } from "zod";

export const createPaymentValidate = z
  .object({
    orderId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid order id"),
  })
  .strict();

export type CreatePaymentInput = z.infer<typeof createPaymentValidate>;

export const refundPaymentValidate = z.object({
  amount: z.number().positive().finite().optional(),
}).strict();

export type RefundPaymentInput = z.infer<typeof refundPaymentValidate>;
