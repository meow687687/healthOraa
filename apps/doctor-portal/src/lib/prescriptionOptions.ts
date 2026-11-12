import type { CreatePrescriptionInput, PrescriptionMedicineInput } from "@healthoraa/validation";
import type { StoredPrescription } from "./prescriptionStore";

export const FREQUENCY_OPTIONS = [
  "Once daily in the morning",
  "Once daily at night",
  "Twice daily after meals",
  "Thrice daily after meals",
  "Once weekly",
  "As needed (SOS)",
] as const;

// Quick follow-up choices. 7 days is the default telemedicine follow-up window.
export const FOLLOWUP_CHIPS = [7, 14, 30] as const;

export const EMPTY_MEDICINE: PrescriptionMedicineInput = {
  name: "",
  dosage: "",
  frequency: "",
  duration_days: 30,
  instructions: "",
};

export const EMPTY_PRESCRIPTION: CreatePrescriptionInput = {
  diagnosis: "",
  clinical_notes: "",
  medicines: [{ ...EMPTY_MEDICINE }],
  followup_days: 7,
};

export const toFormValues = (stored: StoredPrescription | undefined): CreatePrescriptionInput =>
  stored
    ? {
        diagnosis: stored.diagnosis,
        clinical_notes: stored.clinical_notes ?? "",
        medicines: stored.medicines.map((m) => ({ ...m, instructions: m.instructions ?? "" })),
        followup_days: stored.followup_days,
      }
    : { ...EMPTY_PRESCRIPTION, medicines: EMPTY_PRESCRIPTION.medicines.map((m) => ({ ...m })) };

export const addDays = (from: Date, days: number): Date => {
  const next = new Date(from.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
export const formatDate = (date: Date): string => dateFormatter.format(date);
