import { z } from "zod";

const addressFields = {
  label: z.string().trim().min(1).max(40).default("home"),
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(5).max(32),
  street: z.string().trim().min(2).max(200),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zip: z.string().trim().min(1).max(24),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  isDefault: z.boolean().default(false),
};

export const createAddressValidate = z.object(addressFields).strict();
export const updateAddressValidate = z
  .object({
    label: addressFields.label.optional(),
    fullName: addressFields.fullName.optional(),
    phoneNumber: addressFields.phoneNumber.optional(),
    street: addressFields.street.optional(),
    city: addressFields.city.optional(),
    state: addressFields.state.optional(),
    zip: addressFields.zip.optional(),
    country: addressFields.country.optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field");

export type CreateAddressInput = z.infer<typeof createAddressValidate>;
export type UpdateAddressInput = z.infer<typeof updateAddressValidate>;
