 
import { z } from "zod";

const requiredText = (field: string) =>
    z.string({
        error: (e) =>
            e.input === undefined
                ? `${field} is required`
                : `${field} must be text`,
    }).trim();

const objectId = requiredText("Category").regex(
    /^[a-f\d]{24}$/i,
    "Invalid category ID",
);

export const variantValidate = z
    .object({
        sku: z.string().trim().min(1).max(100),
        price: z.number().min(0),
        compareAtPrice: z.number().min(0).optional(),
        stock: z.number().int().min(0),
        barcode: z.string().trim().max(100).optional(),
        weight: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
        options: z.record(z.string(), z.string()).default({}),
        images: z
            .array(
                z.object({
                    url: z.string().url(),
                    public_id: z.string().trim().min(1).optional(),
                    alt: z.string().trim().max(200).optional(),
                    isPrimary: z.boolean().optional(),
                }),
            )
            .max(10)
            .default([]),
    })
    .strict();


export const productValidate = z.object({
    title: requiredText("Title")
        .min(2, "Title must be at least 2 characters long")
        .max(200, "Title cannot exceed 200 characters"),
    description: requiredText("Description")
        .min(1, "Description is required")
        .max(10_000, "Description cannot exceed 10,000 characters"),
    shortDescription: z
        .string({ error: "Short description must be text" })
        .trim()
        .max(500, "Short description cannot exceed 500 characters")
        .optional(),
    category: objectId,
    categories: z.array(objectId).max(20).default([]),
    brand: z
        .string({ error: "Brand must be text" })
        .trim()
        .max(100, "Brand cannot exceed 100 characters")
        .optional(),
    metaTitle: z.string().trim().max(200).optional(),
    metaDescription: z.string().trim().max(500).optional(),
    attributes: z
        .array(
            z.object({
                name: z.string().trim().min(1).max(100),
                value: z.string().trim().max(500),
            }),
        )
        .max(50)
        .default([]),
    images: z
        .array(
            z.object({
                url: z.string().url(),
                public_id: z.string().trim().min(1).optional(),
                alt: z.string().trim().max(200).optional(),
                isPrimary: z.boolean().optional(),
            }),
        )
        .default([]),
    variants: z
        .array(variantValidate)
        .min(1)
        .max(100),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    isDigital: z.boolean().default(false),
    requiresShipping: z.boolean().default(true),
})
    .strict();

export type CreateProductInput = z.infer<typeof productValidate>;
export const productUpdateValidate = productValidate.partial();
export type UpdateProductInput = z.infer<typeof productUpdateValidate>;
export type VariantInput = z.infer<typeof variantValidate>;
 
