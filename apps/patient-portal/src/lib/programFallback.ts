import type { ActiveProgram, ChatMessage, DayLog } from "../types/program";

// Offline demo data. Dates are fixed so the Day 18 demo holds whatever today's date is.
export const FALLBACK_PROGRAM: ActiveProgram = {
  enrolmentId: "fb-enrolment-pcod-001",
  title: "PCOD/PCOS Nutrition Program (Sample)",
  protocolLabel: "PCOD Protocol",
  durationDays: 60,
  currentDay: 18,
  startsAt: "2026-10-25T00:00:00+05:30",
  expiresAt: "2026-12-24T23:59:59+05:30",
  nutritionist: { name: "Sample care team" },
  latestNote: null,
  dataSource: "mock",
};

export const FALLBACK_DAY_LOGS: DayLog[] = [
  {
    dayNumber: 17,
    waterMl: 2250,
    meals: ["breakfast", "lunch", "snack", "dinner"],
  },
  { dayNumber: 18, waterMl: 1250, meals: ["breakfast", "lunch"] },
];

export const FALLBACK_MESSAGES: ChatMessage[] = [
  {
    id: "fb-msg-1",
    senderRole: "dietitian",
    content: "Hello Priya. This is an example message in the program chat.",
    createdAt: "2026-11-11T08:10:00+05:30",
    storage: "server",
  },
  {
    id: "fb-msg-2",
    senderRole: "patient",
    content: "Thanks. I can use this space to ask questions about my program.",
    createdAt: "2026-11-11T08:24:00+05:30",
    storage: "server",
  },
  {
    id: "fb-msg-3",
    senderRole: "dietitian",
    content: "Your care team can share approved program guidance here.",
    createdAt: "2026-11-11T08:31:00+05:30",
    storage: "server",
  },
];
