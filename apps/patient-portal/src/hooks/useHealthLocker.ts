import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadDocumentSchema, DOCUMENT_ACCEPTED_TYPES, DOCUMENT_MAX_BYTES } from "@healthoraa/validation";
import type { DocumentCategory, UploadDocumentInput } from "@healthoraa/validation";
import type { Enums } from "@healthoraa/types";
import { supabase } from "../lib/supabase";
import { usePatient } from "../context/PatientContext";
import { buildBiomarkers } from "../lib/biomarkers";
import type { BiomarkerRow } from "../lib/biomarkers";
import { FALLBACK_BIOMARKERS, FALLBACK_DOCUMENTS } from "../lib/lockerFallback";
import type { Biomarker, HealthLockerData, LockerDocument } from "../types/locker";

const recordsKey = (patientId: string) => ["locker", "records", patientId] as const;
const biomarkersKey = (patientId: string) => ["locker", "biomarkers", patientId] as const;
const uploadsKey = (patientId: string) => ["locker", "uploads", patientId] as const;

interface DocumentRow {
  id: string;
  title: string;
  category: Enums<"diagnostic_category">;
  document_date: string;
  file_path: string;
  file_size_bytes: number | null;
  mime_type: string;
}

const toDocument = (row: DocumentRow): LockerDocument => ({
  id: row.id,
  title: row.title,
  category: row.category as DocumentCategory,
  documentDate: row.document_date,
  fileType: row.mime_type.includes("pdf") ? "pdf" : "image",
  fileSizeBytes: row.file_size_bytes,
  source: "record",
  summary: null,
  file: null,
  filePath: row.file_path,
  canOpen: true,
});

// Anonymous reads are filtered by row-level security, so an empty result cannot be told apart from a
// failed read. Both use the demo value.
const loadOrDemo = async <T>(load: () => Promise<T[]>, demo: T[], label: string): Promise<T[]> => {
  try {
    const rows = await load();
    if (rows.length > 0) return rows;
  } catch (err) {
    console.warn(`[patient-portal] ${label}: query failed, using client fallback`, err);
  }
  return demo;
};

const useRecords = () => {
  const patient = usePatient();
  return useQuery<LockerDocument[], Error>({
    queryKey: recordsKey(patient.id),
    queryFn: () =>
      loadOrDemo(
        async () => {
          const { data, error } = await supabase
            .from("patient_documents")
            .select("id, title, category, document_date, file_path, file_size_bytes, mime_type")
            .eq("patient_id", patient.id)
            .order("document_date", { ascending: false });
          if (error) throw new Error(error.message);
          return ((data ?? []) as DocumentRow[]).map(toDocument);
        },
        FALLBACK_DOCUMENTS,
        "patient documents",
      ),
  });
};

const useBiomarkers = () => {
  const patient = usePatient();
  return useQuery<{ biomarkers: Biomarker[]; source: "live" | "demo" }, Error>({
    queryKey: biomarkersKey(patient.id),
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("patient_biomarkers")
          .select("marker_name, marker_value, unit, reference_range, tested_at")
          .eq("patient_id", patient.id)
          .order("tested_at", { ascending: true });
        if (error) throw new Error(error.message);
        const biomarkers = buildBiomarkers((data ?? []) as BiomarkerRow[]);
        if (biomarkers.length > 0) return { biomarkers, source: "live" as const };
      } catch (err) {
        console.warn("[patient-portal] patient biomarkers: query failed, using client fallback", err);
      }
      return { biomarkers: FALLBACK_BIOMARKERS, source: "demo" as const };
    },
  });
};

// Documents uploaded in this session. Held in the query cache with no refetch and no garbage collection,
// so they survive tab changes. They are not saved anywhere, so a page reload clears them.
const useUploads = () => {
  const patient = usePatient();
  return useQuery<LockerDocument[], Error>({
    queryKey: uploadsKey(patient.id),
    queryFn: async () => [],
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

export const useHealthLocker = () => {
  const records = useRecords();
  const biomarkers = useBiomarkers();
  const uploads = useUploads();

  const data = useMemo<HealthLockerData | undefined>(
    () =>
      records.data && biomarkers.data && uploads.data
        ? {
            documents: [...uploads.data, ...records.data],
            biomarkers: biomarkers.data.biomarkers,
            biomarkerSource: biomarkers.data.source,
          }
        : undefined,
    [records.data, biomarkers.data, uploads.data],
  );

  return {
    data,
    isPending: records.isPending || biomarkers.isPending || uploads.isPending,
    isError: records.isError || biomarkers.isError,
  };
};

export interface UploadDocumentRequest extends UploadDocumentInput {
  file: File;
}

export const validateDocumentFile = (file: File): string | null => {
  if (!(DOCUMENT_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "Upload a PDF, JPEG or PNG file.";
  if (file.size > DOCUMENT_MAX_BYTES) return "Files must be 10 MB or smaller.";
  if (file.size === 0) return "This file is empty.";
  return null;
};

// Validates the details and file, then adds the document to this session's locker.
export const useUploadDocument = () => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<LockerDocument, Error, UploadDocumentRequest>({
    mutationFn: async ({ file, ...fields }) => {
      const parsed = uploadDocumentSchema.safeParse(fields);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the document details.");

      const fileError = validateDocumentFile(file);
      if (fileError) throw new Error(fileError);

      const document: LockerDocument = {
        id: `upload-${crypto.randomUUID()}`,
        title: parsed.data.title,
        category: parsed.data.category,
        documentDate: parsed.data.document_date,
        fileType: file.type === "application/pdf" ? "pdf" : "image",
        fileSizeBytes: file.size,
        source: "upload",
        summary: null,
        file,
        filePath: null,
        canOpen: true,
      };
      return document;
    },
    onSuccess: (document) => {
      queryClient.setQueryData<LockerDocument[]>(uploadsKey(patient.id), (previous) => [document, ...(previous ?? [])]);
    },
  });
};
