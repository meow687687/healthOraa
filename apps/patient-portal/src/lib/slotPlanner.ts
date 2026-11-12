import { istDayKey } from "./istTime";
import type { SlotOption } from "../types/consultations";

const SLOT_MINUTES = 30;
// Morning and evening blocks in IST, as local start times. Matches the schedule the seed publishes.
const BLOCKS: { startHour: number; endHour: number }[] = [
  { startHour: 10, endHour: 13 },
  { startHour: 17, endHour: 20 },
];

// The seven IST calendar days starting today.
export const nextSevenDayKeys = (now: Date): string[] =>
  Array.from({ length: 7 }, (_, index) => istDayKey(new Date(now.getTime() + index * 86_400_000)));

// Demo slots for when the slot table cannot be read. Weekdays only, and only slots still in the future.
export const buildFallbackSlots = (doctorId: string, now: Date): SlotOption[] => {
  const slots: SlotOption[] = [];
  for (const dayKey of nextSevenDayKeys(now)) {
    const weekday = new Date(`${dayKey}T12:00:00+05:30`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const block of BLOCKS) {
      for (let minutes = block.startHour * 60; minutes < block.endHour * 60; minutes += SLOT_MINUTES) {
        const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
        const mm = String(minutes % 60).padStart(2, "0");
        const startsAt = new Date(`${dayKey}T${hh}:${mm}:00+05:30`);
        if (startsAt.getTime() <= now.getTime()) continue;
        slots.push({
          id: `fb-slot-${doctorId.slice(0, 8)}-${dayKey}-${hh}${mm}`,
          doctorId,
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + SLOT_MINUTES * 60_000).toISOString(),
          source: "mock",
        });
      }
    }
  }
  return slots;
};
