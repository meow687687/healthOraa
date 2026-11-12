// Clinic time is India Standard Time. The browser's own zone is ignored so every patient sees the same slots.
const TZ = "Asia/Kolkata";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short" });
const dayNumberFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

// "2026-11-12" for the IST calendar day that contains the instant.
export const istDayKey = (date: Date): string => dayKeyFormatter.format(date);

export const istHour = (date: Date): number =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(date));

export const formatIstWeekday = (date: Date): string => weekdayFormatter.format(date);
export const formatIstDayMonth = (date: Date): string => dayNumberFormatter.format(date);
export const formatIstTime = (iso: string): string => timeFormatter.format(new Date(iso));
export const formatIstDateTime = (iso: string): string => dateTimeFormatter.format(new Date(iso));
