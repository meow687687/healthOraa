// Money and time for the admin. Indian digit grouping (12,34,567) and India Standard Time.
const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const istDay = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
});

// Full amount for tooltips and tables, for example ₹1,29,900.00.
export const formatInrFull = (amount: number): string => inrFull.format(amount);

// Short amount for axes and KPI cards: ₹1.3L, ₹12.4K, ₹860.
export const formatInrCompact = (amount: number): string => {
  const absolute = Math.abs(amount);
  if (absolute >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  if (absolute >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (absolute >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${Math.round(amount)}`;
};

export const formatIstDateTime = (iso: string): string => istDateTime.format(new Date(iso));

// "2026-11-13" is already a calendar day in IST, so it is parsed at IST midnight.
export const formatIstDay = (day: string): string => istDay.format(new Date(`${day}T00:00:00+05:30`));

export const formatCount = (value: number): string => value.toLocaleString("en-IN");

// Percentage change between two values. Null when there is no earlier value to compare with.
export const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};
