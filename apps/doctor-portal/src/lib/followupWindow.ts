// The 7-day follow-up chat window opens when a consultation completes. The same rule
// is enforced by RLS on consultation_messages, so the client mirrors it for display only.
export const FOLLOWUP_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

export const followupWindowFrom = (slotEnd: string): string => {
  const end = new Date(slotEnd);
  end.setDate(end.getDate() + FOLLOWUP_WINDOW_DAYS);
  return end.toISOString();
};

export const isWindowOpen = (expiresAt: string | null, now: number): boolean =>
  expiresAt !== null && now < new Date(expiresAt).getTime();

// Whole days left, rounded up, so a window with 6.5 days left reads "7 days remaining".
export const daysRemaining = (expiresAt: string, now: number): number =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS));
