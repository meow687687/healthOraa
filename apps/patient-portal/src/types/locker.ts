import type { DocumentCategory } from "@healthoraa/validation";

export interface LockerDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  // YYYY-MM-DD for records and demo documents, ISO timestamp for uploads made in this session.
  documentDate: string;
  fileType: "pdf" | "image";
  fileSizeBytes: number | null;
  // "record" is a row in patient_documents, "upload" lives in this session only, "demo" is sample data.
  source: "record" | "upload" | "demo";
  // Demo summary shown in preview, since demo documents have no real file.
  summary: string | null;
  // The file for uploads made in this session.
  file: File | null;
  // Storage path for database records. Opened through a short-lived signed link.
  filePath: string | null;
  canOpen: boolean;
}

export interface BiomarkerRange {
  min?: number;
  max?: number;
  // A "< 100" reference excludes its upper bound.
  maxExclusive?: boolean;
}

export interface BiomarkerReading {
  date: string;
  value: number;
}

export interface Biomarker {
  key: string;
  label: string;
  unit: string;
  range: BiomarkerRange;
  referenceLabel: string;
  readings: BiomarkerReading[];
}

export interface HealthLockerData {
  documents: LockerDocument[];
  biomarkers: Biomarker[];
  biomarkerSource: "live" | "demo";
}
