import { z } from "zod";

// Slot lengths the RPC public.update_practitioner_profile accepts. Keep in sync with it.
export const PRACTICE_SLOT_DURATIONS = [15, 20, 30, 45, 60] as const;

// Practice settings a doctor edits from the Profile tab. The checks mirror the
// update_practitioner_profile RPC so client and database agree on what is valid.
export const updatePractitionerProfileSchema = z.object({
  qualification: z
    .string({ error: "Qualification is required." })
    .trim()
    .min(3, "Qualification must be at least 3 characters.")
    .max(100, "Qualification must be 100 characters or fewer."),
  consultation_fee_inr: z
    .number({ error: "Enter the consultation fee in rupees." })
    .min(0, "Consultation fee cannot be negative."),
  slot_duration_minutes: z
    .number({ error: "Choose a slot duration." })
    .refine((value) => (PRACTICE_SLOT_DURATIONS as readonly number[]).includes(value), {
      error: "Slot duration must be 15, 20, 30, 45, or 60 minutes.",
    }),
  bio: z
    .string()
    .trim()
    .max(1000, "Bio must be 1000 characters or fewer.")
    .optional(),
  languages_spoken: z
    .array(z.string().min(1, "Language names cannot be empty."))
    .min(1, "Choose at least one language."),
  years_of_experience: z
    .number({ error: "Enter your years of experience." })
    .int("Experience must be a whole number of years.")
    .min(0, "Experience cannot be negative.")
    .max(70, "Experience must be 70 years or fewer."),
});

export type UpdatePractitionerProfileInput = z.infer<typeof updatePractitionerProfileSchema>;
