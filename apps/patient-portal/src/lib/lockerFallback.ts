import type { LockerDocument } from "../types/locker";
import { buildBiomarkers } from "./biomarkers";
import type { BiomarkerRow } from "./biomarkers";
import type { Biomarker } from "../types/locker";

// Demo records for the offline view. They mirror the seeded patient_documents and patient_biomarkers rows.
export const FALLBACK_DOCUMENTS: LockerDocument[] = [
  {
    id: "demo-doc-rx",
    title: "Signed Dermatology Prescription",
    category: "prescription",
    documentDate: "2026-11-02",
    fileType: "pdf",
    fileSizeBytes: 96 * 1024,
    source: "demo",
    summary: "Topical adapalene each night and a benzoyl peroxide wash each morning. Review in four weeks.",
    file: null,
    filePath: null,
    canOpen: true,
  },
  {
    id: "demo-doc-metabolic",
    title: "Comprehensive Metabolic Panel & HbA1c",
    category: "blood_panel",
    documentDate: "2026-10-15",
    fileType: "pdf",
    fileSizeBytes: 412 * 1024,
    source: "demo",
    summary: "HbA1c 6.1 percent, fasting glucose 104 mg/dL, TSH 3.8 uIU/mL and LDL 128 mg/dL. HbA1c and fasting glucose are above the healthy range.",
    file: null,
    filePath: null,
    canOpen: true,
  },
  {
    id: "demo-doc-usg",
    title: "Pelvic Ultrasound Report",
    category: "imaging_radiology",
    documentDate: "2026-09-20",
    fileType: "pdf",
    fileSizeBytes: 1800 * 1024,
    source: "demo",
    summary: "Bilateral polycystic-appearing ovaries with more than 12 follicles per ovary. Endometrium 6 mm.",
    file: null,
    filePath: null,
    canOpen: true,
  },
];

export const FALLBACK_BIOMARKER_ROWS: BiomarkerRow[] = [
  { marker_name: "hba1c", marker_value: 5.9, unit: "%", reference_range: "4.0 - 5.6", tested_at: "2026-04-18" },
  { marker_name: "hba1c", marker_value: 6.1, unit: "%", reference_range: "4.0 - 5.6", tested_at: "2026-10-15" },
  { marker_name: "fasting_blood_sugar", marker_value: 98, unit: "mg/dL", reference_range: "70 - 99", tested_at: "2026-04-18" },
  { marker_name: "fasting_blood_sugar", marker_value: 104, unit: "mg/dL", reference_range: "70 - 99", tested_at: "2026-10-15" },
  { marker_name: "tsh", marker_value: 4.6, unit: "uIU/mL", reference_range: "0.4 - 4.0", tested_at: "2026-04-18" },
  { marker_name: "tsh", marker_value: 3.8, unit: "uIU/mL", reference_range: "0.4 - 4.0", tested_at: "2026-10-15" },
  { marker_name: "ldl_cholesterol", marker_value: 141, unit: "mg/dL", reference_range: "< 100", tested_at: "2025-11-04" },
  { marker_name: "ldl_cholesterol", marker_value: 128, unit: "mg/dL", reference_range: "< 100", tested_at: "2026-10-15" },
];

export const FALLBACK_BIOMARKERS: Biomarker[] = buildBiomarkers(FALLBACK_BIOMARKER_ROWS);
