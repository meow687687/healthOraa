const DAY_MS = 86_400_000;

// Day 1 is the calendar day the program started. Clamped to the protocol length.
export const programDayFor = (startsAt: string, durationDays: number, now: Date): number => {
  const elapsedDays = Math.floor((now.getTime() - new Date(startsAt).getTime()) / DAY_MS);
  return Math.min(Math.max(elapsedDays + 1, 1), durationDays);
};
