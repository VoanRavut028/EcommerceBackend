import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const addCartItemValidate = z
  .object({
    productId: objectId,
    variantId: objectId,
    quantity: z.number().int().min(1).max(999).default(1),
  })
  .strict();

export const updateCartItemValidate = z
  .object({
    quantity: z.number().int().min(1).max(999),
  })
  .strict();

export type AddCartItemInput = z.infer<typeof addCartItemValidate>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemValidate>;
