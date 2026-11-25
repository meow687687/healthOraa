export const INDIA_TIME_ZONE = "Asia/Kolkata";

const INDIA_OFFSET_MS = 330 * 60_000;
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: INDIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

export const indiaDateKey = (value: Date | string): string =>
  dateKeyFormatter.format(value instanceof Date ? value : new Date(value));

export const startOfIndiaDay = (now: Date = new Date()): Date => {
  const [year, month, day] = indiaDateKey(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - INDIA_OFFSET_MS);
};

export const formatIndiaDate = (date: Date): string =>
  dateFormatter.format(date);

export const formatIndiaTime = (iso: string): string =>
  timeFormatter.format(new Date(iso));

export const formatIndiaDateTime = (iso: string): string =>
  dateTimeFormatter.format(new Date(iso));
