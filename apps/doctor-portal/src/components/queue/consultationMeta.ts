import type { Tone } from "@healthoraa/ui";
import type { ConsultationStatus } from "../../types/queue";

export const CONSULTATION_STATUS_META: Record<ConsultationStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "amber" },
  in_progress: { label: "In Progress", tone: "emerald" },
  completed: { label: "Completed", tone: "blue" },
  cancelled: { label: "Cancelled", tone: "red" },
};

const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string): string => timeFormatter.format(new Date(iso));
