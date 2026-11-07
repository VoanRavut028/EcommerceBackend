import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid category id");
const parentId = objectId.nullable();

export const createCategoryValidate = z
  .object({
    title: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens")
      .optional(),
    parent: parentId.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateCategoryValidate = createCategoryValidate.partial();

export type CreateCategoryInput = z.infer<typeof createCategoryValidate>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryValidate>;
