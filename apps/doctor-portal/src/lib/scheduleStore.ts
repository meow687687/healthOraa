import type { ConsultationSlot, ScheduleSnapshot } from "../types/schedule";

// Client copy of the schedule edits. Writes are local until the practitioner session can call
// generate_consultation_slots. Survives reloads through localStorage.
export interface ScheduleStoreState {
  draft: ScheduleSnapshot | null;
  published: ScheduleSnapshot | null;
  publishedSlots: ConsultationSlot[] | null;
  publishedAt: string | null;
}

const STORAGE_KEY = "healthoraa.doctor.schedule.v1";
const EMPTY: ScheduleStoreState = { draft: null, published: null, publishedSlots: null, publishedAt: null };

const load = (): ScheduleStoreState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? { ...EMPTY, ...(parsed as Partial<ScheduleStoreState>) } : EMPTY;
  } catch {
    return EMPTY;
  }
};

let memory: ScheduleStoreState = load();

export const readScheduleStore = (): ScheduleStoreState => memory;

export const writeScheduleStore = (patch: Partial<ScheduleStoreState>): void => {
  memory = { ...memory, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage blocked or full: the in-memory copy still holds the change for this session.
  }
};
