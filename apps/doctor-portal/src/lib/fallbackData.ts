import type { QueueConsultation } from "../types/queue";
import { followupWindowFrom } from "./followupWindow";

// Fixed when the module loads, so mock timestamps and expiries stay stable across refetches.
export const FALLBACK_ANCHOR = new Date();

// Client fallback for the queue. Slots are placed relative to `now` so the demo
// always shows one live, one upcoming and one finished consultation.
export const buildFallbackQueue = (now: Date): QueueConsultation[] => {
  const at = (minutes: number): string => new Date(now.getTime() + minutes * 60_000).toISOString();
  const completedSlotEnd = at(-150);
  return [
    {
      id: "fb-consultation-001",
      patientId: null,
      patientName: "Meera Iyer",
      age: 29,
      gender: "Female",
      chiefComplaint: "Severe cystic acne & irregular cycles - PCOD evaluation",
      slotStart: at(-10),
      slotEnd: at(20),
      status: "in_progress",
      followupExpiresAt: null,
    },
    {
      id: "fb-consultation-002",
      patientId: null,
      patientName: "Rohan Kapoor",
      age: 34,
      gender: "Male",
      chiefComplaint: "Persistent fatigue & weight gain - metabolic review",
      slotStart: at(30),
      slotEnd: at(60),
      status: "scheduled",
      followupExpiresAt: null,
    },
    {
      id: "fb-consultation-003",
      patientId: null,
      patientName: "Anjali Desai",
      age: 41,
      gender: "Female",
      chiefComplaint: "Hypertension follow-up & low-sodium diet review",
      slotStart: at(-180),
      slotEnd: completedSlotEnd,
      status: "completed",
      followupExpiresAt: followupWindowFrom(completedSlotEnd),
    },
  ];
};
