import { availabilityWindowSchema, slotDurationSchema, timeToMinutes } from "@healthoraa/validation";
import type { ConsultationSlot, ScheduleSnapshot, WindowDraft } from "../types/schedule";
import { FALLBACK_ANCHOR } from "./fallbackData";

export const UPCOMING_DAYS = 7;

// Monday first. Values are JavaScript day numbers, where 0 is Sunday.
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_NAMES: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

// Mock weekly schedule: Monday to Friday, 09:00-13:00 and 16:00-19:00.
export const FALLBACK_RULES: WindowDraft[] = [1, 2, 3, 4, 5].flatMap((day) => [
  { id: `fb-rule-${day}-morning`, day_of_week: day, start_time: "09:00", end_time: "13:00", is_active: true },
  { id: `fb-rule-${day}-evening`, day_of_week: day, start_time: "16:00", end_time: "19:00", is_active: true },
]);

// Slots for `days` consecutive days from `from`, starting at local midnight. Only active windows count.
export const generateSlots = (
  rules: WindowDraft[],
  durationMinutes: number,
  from: Date,
  days: number,
): ConsultationSlot[] => {
  const slots: ConsultationSlot[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    for (const rule of rules) {
      if (!rule.is_active || rule.day_of_week !== day.getDay()) continue;
      const windowStart = timeToMinutes(rule.start_time);
      const windowEnd = timeToMinutes(rule.end_time);
      for (let minute = windowStart; minute + durationMinutes <= windowEnd; minute += durationMinutes) {
        const slotStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
        slots.push({
          id: `${slotStart.toISOString()}`,
          slotStart: slotStart.toISOString(),
          slotEnd: slotEnd.toISOString(),
          status: "open",
        });
      }
    }
  }
  return slots.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
};

// Mock slots for the upcoming week. Every ninth slot is booked so the preview shows both states.
export const buildFallbackSlots = (): ConsultationSlot[] =>
  generateSlots(FALLBACK_RULES, 30, FALLBACK_ANCHOR, UPCOMING_DAYS).map((slot, index) =>
    index % 9 === 4 ? { ...slot, status: "booked" } : slot,
  );

// Ids of windows that overlap another window on the same day.
export const conflictingRuleIds = (rules: WindowDraft[]): Set<string> => {
  const conflicts = new Set<string>();
  for (const a of rules) {
    for (const b of rules) {
      if (a.id === b.id || a.day_of_week !== b.day_of_week) continue;
      const overlaps = timeToMinutes(a.start_time) < timeToMinutes(b.end_time) &&
        timeToMinutes(b.start_time) < timeToMinutes(a.end_time);
      if (overlaps) conflicts.add(a.id);
    }
  }
  return conflicts;
};

// Throws the first problem found. Used at the mutation boundary, not only by the form.
export const validateSnapshot = (snapshot: ScheduleSnapshot): void => {
  const duration = slotDurationSchema.safeParse(snapshot.durationMinutes);
  if (!duration.success) throw new Error(duration.error.issues[0]?.message ?? "Invalid slot length.");
  for (const rule of snapshot.rules) {
    const parsed = availabilityWindowSchema.safeParse(rule);
    if (!parsed.success) throw new Error(`${DAY_NAMES[rule.day_of_week] ?? "Window"}: ${parsed.error.issues[0]?.message}`);
  }
  if (conflictingRuleIds(snapshot.rules).size > 0) throw new Error("Time windows on the same day overlap.");
};

const normalise = (snapshot: ScheduleSnapshot) => ({
  durationMinutes: snapshot.durationMinutes,
  rules: snapshot.rules
    .map(({ day_of_week, start_time, end_time, is_active }) => ({ day_of_week, start_time, end_time, is_active }))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)),
});

export const snapshotsEqual = (a: ScheduleSnapshot, b: ScheduleSnapshot): boolean =>
  JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
