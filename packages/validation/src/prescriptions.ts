import { z } from "zod";

// One line of the Rx itemizer. Dosage and frequency are required, so they need a minimum length.
export const prescriptionMedicineSchema = z.object({
  name: z
    .string({ error: "Medicine name is required." })
    .trim()
    .min(2, "Medicine name must be at least 2 characters.")
    .max(120, "Medicine name must be 120 characters or fewer."),
  dosage: z
    .string({ error: "Dosage is required." })
    .trim()
    .min(1, "Dosage is required.")
    .max(60, "Dosage must be 60 characters or fewer."),
  frequency: z
    .string({ error: "Frequency is required." })
    .trim()
    .min(1, "Frequency is required.")
    .max(120, "Frequency must be 120 characters or fewer."),
  duration_days: z
    .number({ error: "Duration must be a number of days." })
    .int("Duration must be a whole number of days.")
    .min(1, "Duration must be at least 1 day.")
    .max(180, "Duration must be 180 days or fewer."),
  instructions: z
    .string()
    .trim()
    .max(240, "Instructions must be 240 characters or fewer.")
    .optional(),
});

export const createPrescriptionSchema = z.object({
  diagnosis: z
    .string({ error: "Diagnosis is required." })
    .trim()
    .min(3, "Diagnosis must be at least 3 characters.")
    .max(200, "Diagnosis must be 200 characters or fewer."),
  clinical_notes: z
    .string()
    .trim()
    .max(2000, "Clinical notes must be 2000 characters or fewer.")
    .optional(),
  medicines: z
    .array(prescriptionMedicineSchema)
    .min(1, "Add at least one medicine."),
  followup_days: z
    .number({ error: "Follow-up must be a number of days." })
    .int("Follow-up must be a whole number of days.")
    .min(0, "Follow-up cannot be negative.")
    .max(60, "Follow-up must be 60 days or fewer.")
    .default(7),
});

export type PrescriptionMedicineInput = z.infer<typeof prescriptionMedicineSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
// Form-side type: `followup_days` is optional here because the schema default fills it in.
export type CreatePrescriptionFormValues = z.input<typeof createPrescriptionSchema>;
