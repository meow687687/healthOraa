import { z } from "zod";

export const PRODUCT_CATEGORY_VALUES = [
  "supplements",
  "ayurvedic",
  "skincare",
  "equipment",
] as const;

export const createProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(3, "SKU must be at least 3 characters.")
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, "SKU must be uppercase letters, digits or hyphens."),
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(140, "Title must be 140 characters or fewer."),
  category: z.enum(PRODUCT_CATEGORY_VALUES, {
    error: "Select a valid category.",
  }),
  price_inr: z
    .number({ error: "Price must be a number." })
    .min(1, "Price must be at least ₹1."),
  stock_count: z
    .number({ error: "Stock must be a number." })
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative."),
  description: z.string().trim().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
