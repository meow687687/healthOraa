import { z } from "zod";

export const PROGRAM_CATEGORY_VALUES = [
  "weight_management",
  "pcod_pcos",
  "dermato_nutrition",
  "custom",
] as const;

export const createProgramSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be 120 characters or fewer."),
  category: z.enum(PROGRAM_CATEGORY_VALUES, {
    error: "Select a valid category.",
  }),
  duration_days: z
    .number({ error: "Duration must be a number." })
    .int("Duration must be a whole number of days.")
    .min(7, "Duration must be at least 7 days.")
    .max(365, "Duration must be 365 days or fewer.")
    .default(60),
  price_inr: z
    .number({ error: "Price must be a number." })
    .positive("Price must be greater than 0.")
    .min(0, "Price cannot be negative."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer.")
    .optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
