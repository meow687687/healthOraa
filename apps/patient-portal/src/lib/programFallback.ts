import type { ActiveProgram, ChatMessage, DayLog } from "../types/program";

// Offline demo data. Dates are fixed so the Day 18 demo holds whatever today's date is.
export const FALLBACK_PROGRAM: ActiveProgram = {
  enrolmentId: "fb-enrolment-pcod-001",
  title: "60-Day PCOD/PCOS Reset",
  protocolLabel: "PCOD Protocol",
  durationDays: 60,
  currentDay: 18,
  startsAt: "2026-10-25T00:00:00+05:30",
  expiresAt: "2026-12-24T23:59:59+05:30",
  nutritionist: { name: "Kavya Iyer" },
  latestNote: {
    body: "Day 18: your water intake is on track this week. Add a 10-minute walk after dinner and keep the evening snack to nuts or curd.",
    postedAt: "2026-11-10T18:30:00+05:30",
  },
  dataSource: "mock",
};

export const FALLBACK_DAY_LOGS: DayLog[] = [
  { dayNumber: 17, waterMl: 2250, meals: ["breakfast", "lunch", "snack", "dinner"] },
  { dayNumber: 18, waterMl: 1250, meals: ["breakfast", "lunch"] },
];

export const FALLBACK_MESSAGES: ChatMessage[] = [
  {
    id: "fb-msg-1",
    senderRole: "dietitian",
    content: "Good morning Priya. Day 18 check-in: how is the lentil lunch sitting with you?",
    createdAt: "2026-11-11T08:10:00+05:30",
    storage: "server",
  },
  {
    id: "fb-msg-2",
    senderRole: "patient",
    content: "Much better than last week. I'm not feeling bloated after lunch anymore.",
    createdAt: "2026-11-11T08:24:00+05:30",
    storage: "server",
  },
  {
    id: "fb-msg-3",
    senderRole: "dietitian",
    content: "That's a good sign. Keep the portion at one katori and add the cucumber raita on the side.",
    createdAt: "2026-11-11T08:31:00+05:30",
    storage: "server",
  },
];
