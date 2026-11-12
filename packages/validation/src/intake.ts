import { z } from "zod";

export const PATIENT_GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;

// One allergy or medication entry. Short enough to read at a glance, long enough to be meaningful.
const listEntry = z
  .string()
  .trim()
  .min(1, "Entries cannot be blank.")
  .max(100, "Keep each entry under 100 characters.");

// Clinical intake captured before a consultation is booked.
export const patientIntakeSchema = z.object({
  age: z
    .number({ error: "Enter your age." })
    .int("Age must be a whole number.")
    .min(1, "Age must be at least 1.")
    .max(120, "Age must be 120 or less."),
  gender: z.enum(PATIENT_GENDERS, { error: "Choose a gender option." }),
  chief_complaint: z
    .string({ error: "Describe your main concern." })
    .trim()
    .min(10, "Describe your concern in at least 10 characters.")
    .max(1000, "Keep the description under 1000 characters."),
  symptoms_duration: z
    .string({ error: "Tell us how long you have had this." })
    .trim()
    .min(2, "Enter how long you have had symptoms."),
  known_allergies: z.array(listEntry).max(20, "List up to 20 allergies.").optional(),
  current_medications: z.array(listEntry).max(20, "List up to 20 medications.").optional(),
});

export type PatientIntakeInput = z.infer<typeof patientIntakeSchema>;
