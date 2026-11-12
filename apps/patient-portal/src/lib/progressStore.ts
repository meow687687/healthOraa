import { FALLBACK_DAY_LOGS } from "./programFallback";
import type { DayLog } from "../types/program";

// Day logs for the offline demo program, kept in this browser. Live programs write to the database.
const STORAGE_KEY = "healthoraa.patient.progress.v1";

type ProgressStore = Record<string, DayLog[]>;

const readStore = (): ProgressStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressStore) : {};
  } catch {
    return {};
  }
};

export const upsertDay = (days: DayLog[], day: DayLog): DayLog[] =>
  [...days.filter((item) => item.dayNumber !== day.dayNumber), day].sort((a, b) => a.dayNumber - b.dayNumber);

export const readMockDayLogs = (enrolmentId: string): DayLog[] => readStore()[enrolmentId] ?? FALLBACK_DAY_LOGS;

export const writeMockDayLog = (enrolmentId: string, day: DayLog): void => {
  const store = readStore();
  store[enrolmentId] = upsertDay(store[enrolmentId] ?? FALLBACK_DAY_LOGS, day);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};
