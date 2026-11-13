// Demo consultations have no row to update, so a start is remembered on this device.
// Live consultations are updated in the database and never use this store.
const STORAGE_KEY = "healthoraa.doctor.started.v1";

const readIds = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
};

const memory = new Set<string>(readIds());

export const startedConsultationIds = (): Set<string> => new Set(memory);

export const markConsultationStarted = (consultationId: string): void => {
  memory.add(consultationId);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...memory]));
  } catch {
    // Storage is full or disabled. The start still holds for this page session.
  }
};
