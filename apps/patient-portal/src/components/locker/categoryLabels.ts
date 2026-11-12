import type { DocumentCategory } from "@healthoraa/validation";

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  blood_panel: "Blood panel",
  imaging_radiology: "Imaging / scan",
  prescription: "Prescription",
  discharge_summary: "Discharge summary",
  other: "Other",
};
