import { z } from "zod";

export const DOCUMENT_CATEGORIES = [
  "blood_panel",
  "imaging_radiology",
  "prescription",
  "discharge_summary",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// Files the locker accepts. Checked again in the browser before upload and by storage rules later.
export const DOCUMENT_ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Local calendar date, so "today" matches what the patient sees on their device.
export const localTodayKey = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

// Date.parse accepts 2026-02-30, so compare the parts after the round trip instead.
const isRealCalendarDate = (value: string): boolean => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// Metadata for one document in the Health Locker. The file itself is checked separately.
export const uploadDocumentSchema = z.object({
  title: z
    .string({ error: "Give the document a title." })
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be 120 characters or fewer."),
  category: z.enum(DOCUMENT_CATEGORIES, { error: "Choose a category." }),
  document_date: z
    .string({ error: "Choose the date on the document." })
    .regex(ISO_DATE, "Use the date format YYYY-MM-DD.")
    .refine(isRealCalendarDate, "Enter a real date.")
    .refine((value) => value <= localTodayKey(), "The document date cannot be in the future."),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
