import { PANEL, cn } from "@healthoraa/ui";
import { formatTime, timingLine } from "./consultationMeta";
import { IntakeSummary } from "./IntakeSummary";
import { QueueAction, type QueueCardProps } from "./QueueCard";

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
        <h2 id={`consultation-${consultation.id}`} tabIndex={-1} className="rounded-sm text-2xl font-bold tracking-tight text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue">
          {consultation.patientName}
        </h2>
        <p className="text-sm text-text-secondary">
          {timingLine(consultation, now)} · {formatTime(consultation.slotStart)} to {formatTime(consultation.slotEnd)}
        </p>
      </header>
      <IntakeSummary consultation={consultation} />
      <div className="flex flex-wrap gap-2">
        <QueueAction {...props} now={now} />
      </div>
    </article>
  );
}
