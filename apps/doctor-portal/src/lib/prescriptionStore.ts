import type { CreatePrescriptionInput } from "@healthoraa/validation";

// A signed prescription as kept on the client. The backend has no prescriptions table yet,
// so this local cache is the only persistence. It survives reloads through localStorage.
export interface StoredPrescription extends CreatePrescriptionInput {
  id: string;
  consultationId: string;
  patientName: string;
  doctorId: string;
  signedAt: string;
  followupUntil: string;
}

const STORAGE_KEY = "healthoraa.doctor.prescriptions.v1";

const isStoredPrescription = (value: unknown): value is StoredPrescription =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as StoredPrescription).id === "string" &&
  typeof (value as StoredPrescription).consultationId === "string" &&
  Array.isArray((value as StoredPrescription).medicines);

const loadFromStorage = (): StoredPrescription[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredPrescription) : [];
  } catch {
    // Storage blocked or corrupt: start from an empty in-memory cache.
    return [];
  }
};

// Memory is the source of truth for this session. Writes go through to localStorage when it works.
let memoryStore: StoredPrescription[] = loadFromStorage();

const writeThrough = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  } catch {
    // Quota exceeded or storage disabled: the in-memory copy still holds the record.
  }
};

export const getStoredPrescription = (consultationId: string): StoredPrescription | undefined =>
  memoryStore.find((record) => record.consultationId === consultationId);

// One current prescription per consultation. Re-signing replaces the earlier record.
export const saveStoredPrescription = (record: StoredPrescription): void => {
  memoryStore = [...memoryStore.filter((r) => r.consultationId !== record.consultationId), record];
  writeThrough();
};

export const signedConsultationIds = (): Set<string> =>
  new Set(memoryStore.map((record) => record.consultationId));
