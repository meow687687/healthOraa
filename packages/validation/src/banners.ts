import { z } from "zod";

export const BANNER_TARGET_TYPE_VALUES = [
  "program",
  "doctor",
  "shop_product",
  "external_url",
] as const;

export const createBannerSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(100, "Title must be 100 characters or fewer."),
  image_url: z
    .string()
    .trim()
    .url("Enter a valid image URL, including https://."),
  target_type: z.enum(BANNER_TARGET_TYPE_VALUES, {
    error: "Select a valid target type.",
  }),
  target_id: z.string().trim().optional(),
  display_order: z
    .number({ error: "Display order must be a number." })
    .int("Display order must be a whole number.")
    .min(0, "Display order cannot be negative."),
});

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
