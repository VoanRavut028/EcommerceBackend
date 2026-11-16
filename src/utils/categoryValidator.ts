import { z } from "zod";
import { CATEGORY_TYPES } from "../models/categories.model.ts";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid category id");
const parentId = objectId.nullable();

const categoryFieldsValidate = z
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
    type: z.enum(CATEGORY_TYPES).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const createCategoryValidate = categoryFieldsValidate.superRefine(
  (category, context) => {
    if (!category.parent && !category.type) {
      context.addIssue({
        code: "custom",
        path: ["type"],
        message: "type is required for a top-level category",
      });
    }
  },
);

export const updateCategoryValidate = categoryFieldsValidate.partial();

export type CreateCategoryInput = z.infer<typeof createCategoryValidate>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryValidate>;
