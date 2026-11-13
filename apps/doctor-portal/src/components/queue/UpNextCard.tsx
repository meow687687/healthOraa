import { PANEL, cn } from "@healthoraa/ui";
import type { QueueConsultation } from "../../types/queue";
import { formatTime } from "./consultationMeta";
import { IntakeSummary } from "./IntakeSummary";
import { QueueAction, type QueueCardProps } from "./QueueCard";

// Minutes from `now` to the slot start. Negative once the slot has begun.
const minutesUntil = (iso: string, now: number): number => Math.round((Date.parse(iso) - now) / 60_000);

export function timingLine(consultation: QueueConsultation, now: number): string {
  if (consultation.status === "completed") return "Completed";
  if (consultation.status === "cancelled") return "Cancelled";
  const diff = minutesUntil(consultation.slotStart, now);
  if (consultation.status === "in_progress") return `In progress for ${Math.max(0, -diff)} min`;
  if (diff > 0) return `Starts in ${diff} min`;
  return diff === 0 ? "Starts now" : `Started ${-diff} min ago, not yet begun`;
}

// The next patient, with the intake a doctor needs before the call.
export function UpNextCard({ now, ...props }: QueueCardProps & { now: number }) {
  const { consultation } = props;
  const heading = consultation.status === "in_progress" ? "In progress" : "Up next";

  return (
    <article
      aria-labelledby={`consultation-${consultation.id}`}
      className={cn(PANEL, "space-y-6 p-6 md:p-8", props.isActiveRoom && "border-accent-emerald/40")}
    >
      <header className="space-y-1">
        <p className="text-[13px] font-semibold text-accent-blue">{heading}</p>
        <h2 id={`consultation-${consultation.id}`} className="text-2xl font-bold tracking-tight text-text-primary">
          {consultation.patientName}
        </h2>
        <p className="text-sm text-text-secondary">
          {timingLine(consultation, now)} · {formatTime(consultation.slotStart)} to {formatTime(consultation.slotEnd)}
        </p>
      </header>
      <IntakeSummary consultation={consultation} />
      <div className="flex flex-wrap gap-2">
        <QueueAction {...props} />
      </div>
    </article>
  );
}
