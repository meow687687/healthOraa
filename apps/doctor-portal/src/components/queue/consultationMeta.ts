import type { Tone } from "@healthoraa/ui";
import type { ConsultationStatus, QueueConsultation } from "../../types/queue";

export const CONSULTATION_STATUS_META: Record<ConsultationStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "amber" },
  in_progress: { label: "In Progress", tone: "emerald" },
  completed: { label: "Completed", tone: "blue" },
  cancelled: { label: "Cancelled", tone: "red" },
};

const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string): string => timeFormatter.format(new Date(iso));

const minutesUntil = (iso: string, now: number): number => Math.round((Date.parse(iso) - now) / 60_000);

export function timingLine(consultation: QueueConsultation, now: number): string {
  if (consultation.status === "completed") return "Completed";
  if (consultation.status === "cancelled") return "Cancelled";
  const diff = minutesUntil(consultation.slotStart, now);
  if (consultation.status === "in_progress") return `In progress for ${Math.max(0, -diff)} min`;
  if (diff > 0) return `Starts in ${diff} min`;
  return diff === 0 ? "Starts now" : `Started ${-diff} min ago, not yet begun`;
}
