const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

export type AvailabilityRule = {
  practitioner_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
export type Practitioner = { id: string; slot_duration_minutes: number };
export type Slot = {
  practitioner_id: string;
  start_time: string;
  end_time: string;
  is_booked: false;
};

function istDateParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((
      part,
    ) => [part.type, Number(part.value)]),
  ) as {
    year: number;
    month: number;
    day: number;
  };
}

function timeInIst(date: Date, time: string): Date {
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      seconds,
    ) - IST_OFFSET_MS,
  );
}

export function makeSlots(
  practitioners: Practitioner[],
  rules: AvailabilityRule[],
  existing: Set<string>,
  now: Date,
): Slot[] {
  const durations = new Map(
    practitioners.map((
      practitioner,
    ) => [practitioner.id, practitioner.slot_duration_minutes]),
  );
  const firstDay = istDateParts(now);
  const firstDate = new Date(
    Date.UTC(firstDay.year, firstDay.month - 1, firstDay.day),
  );
  const generated = new Map<string, Slot>();

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(firstDate.getTime() + dayOffset * DAY_MS);
    const weekday = date.getUTCDay();
    for (const rule of rules) {
      if (rule.day_of_week !== weekday) continue;
      const duration = durations.get(rule.practitioner_id);
      if (!duration || duration <= 0) continue;
      const rangeStart = timeInIst(date, rule.start_time);
      const rangeEnd = timeInIst(date, rule.end_time);
      for (
        let start = rangeStart;
        start.getTime() + duration * 60_000 <= rangeEnd.getTime();
        start = new Date(start.getTime() + duration * 60_000)
      ) {
        if (start <= now) continue;
        const startTime = start.toISOString();
        const key = `${rule.practitioner_id}:${startTime}`;
        if (existing.has(key) || generated.has(key)) continue;
        generated.set(key, {
          practitioner_id: rule.practitioner_id,
          start_time: startTime,
          end_time: new Date(start.getTime() + duration * 60_000).toISOString(),
          is_booked: false,
        });
      }
    }
  }
  return [...generated.values()];
}

export function istWindow(now: Date): { start: Date; end: Date } {
  const today = istDateParts(now);
  const start = new Date(
    Date.UTC(today.year, today.month - 1, today.day) - IST_OFFSET_MS,
  );
  return { start, end: new Date(start.getTime() + 14 * DAY_MS) };
}
