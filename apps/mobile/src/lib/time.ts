// Clinic times are shown in India Standard Time. Computed from a fixed +05:30 offset, so no Intl support is needed.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (value: number): string => String(value).padStart(2, '0');

const istShifted = (iso: string | Date): Date => new Date(new Date(iso).getTime() + IST_OFFSET_MS);

export const istDayKey = (iso: string | Date): string => {
  const d = istShifted(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const istHour = (iso: string | Date): number => istShifted(iso).getUTCHours();

export const formatIstTime = (iso: string | Date): string => {
  const d = istShifted(iso);
  const hour = d.getUTCHours();
  return `${hour % 12 || 12}:${pad(d.getUTCMinutes())} ${hour < 12 ? 'AM' : 'PM'}`;
};

export const formatIstDate = (iso: string | Date): string => {
  const d = istShifted(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

export const formatIstShortDate = (iso: string | Date): string => {
  const d = istShifted(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

export const formatIstDateTime = (iso: string | Date): string => `${formatIstDate(iso)} · ${formatIstTime(iso)}`;

// Whole days from now until a future instant, rounded up. Zero or less means it has passed.
export const daysUntil = (iso: string, now: Date = new Date()): number =>
  Math.ceil((new Date(iso).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
