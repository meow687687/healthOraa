export const MEAL_IDS = ["breakfast", "lunch", "snack", "dinner"] as const;
export type MealId = (typeof MEAL_IDS)[number];

// One day of the protocol: water logged and meals marked on plan.
export interface DayLog {
  dayNumber: number;
  waterMl: number;
  meals: MealId[];
}

// The patient's active nutrition program, as the Programs view shows it.
export interface ActiveProgram {
  enrolmentId: string;
  title: string;
  protocolLabel: string;
  durationDays: number;
  currentDay: number;
  startsAt: string;
  expiresAt: string;
  nutritionist: { name: string } | null;
  latestNote: ProgramNote | null;
  dataSource: "live" | "mock";
}

export interface ProgramNote {
  body: string;
  postedAt: string;
}

export interface ActiveProgramData {
  program: ActiveProgram;
  dayLogs: DayLog[];
}

// "device" messages were written to this browser only, because the server rejected the insert.
export interface ChatMessage {
  id: string;
  senderRole: "patient" | "dietitian";
  content: string;
  createdAt: string;
  storage: "server" | "device";
}
