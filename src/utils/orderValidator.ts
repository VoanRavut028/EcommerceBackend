import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const checkoutValidate = z
  .object({ addressId: objectId })
  .strict();

export const updateOrderStatusValidate = z
  .object({
    status: z.enum([
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "returned",
    ]),
  })
  .strict();

export type CheckoutInput = z.infer<typeof checkoutValidate>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusValidate>;
