import { Badge, PANEL, cn } from "@healthoraa/ui";
import type { QueueConsultation } from "../../types/queue";
import { CONSULTATION_STATUS_META, formatTime } from "./consultationMeta";

interface QueueCardProps {
  consultation: QueueConsultation;
  isActiveRoom: boolean;
  onOpenEncounter: (consultation: QueueConsultation) => void;
  onOpenChat: (consultation: QueueConsultation) => void;
}

const SECONDARY_PILL =
  "inline-flex items-center gap-2 bg-aura-s2 hover:bg-aura-s3 border border-aura-line text-text-secondary font-medium px-4 py-2 rounded-full transition-colors";

// Every actionable state opens the encounter drawer: intake preview, Rx composer, or notes.
function QueueAction({ consultation, isActiveRoom, onOpenEncounter, onOpenChat }: QueueCardProps) {
  switch (consultation.status) {
    case "in_progress":
      return (
        <button
          type="button"
          onClick={() => onOpenEncounter(consultation)}
          aria-pressed={isActiveRoom}
          className="inline-flex items-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-full font-semibold px-4 py-2 shadow-lg shadow-accent-blue-glow transition-all active:scale-[0.98]"
        >
          Enter Telemedicine Room
        </button>
      );
    case "scheduled":
      return (
        <button type="button" onClick={() => onOpenEncounter(consultation)} className={SECONDARY_PILL}>
          Review Intake Form
        </button>
      );
    case "completed":
      return (
        <>
          <button type="button" onClick={() => onOpenEncounter(consultation)} className={SECONDARY_PILL}>
            Write Prescription / View Notes
          </button>
          <button type="button" onClick={() => onOpenChat(consultation)} className={SECONDARY_PILL}>
            Open Follow-up Chat
          </button>
        </>
      );
    case "cancelled":
      return <span className="text-xs font-mono text-text-muted">No action</span>;
  }
}

export function QueueCard(props: QueueCardProps) {
  const { consultation, isActiveRoom } = props;
  const meta = CONSULTATION_STATUS_META[consultation.status];
  const ageLine =
    consultation.age !== null
      ? `${consultation.age} yrs${consultation.gender ? ` · ${consultation.gender}` : ""}`
      : "Age not on file";

  return (
    <article
      aria-labelledby={`consultation-${consultation.id}`}
      className={cn(
        PANEL,
        "flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6",
        isActiveRoom && "border-accent-emerald/40",
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="shrink-0 rounded-2xl border border-aura-line bg-aura-s2 px-3 py-2 text-center">
          <p className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-text-primary">
            {formatTime(consultation.slotStart)}
          </p>
          <p className="whitespace-nowrap font-mono text-xs tabular-nums text-text-muted">
            {formatTime(consultation.slotEnd)}
          </p>
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`consultation-${consultation.id}`} className="text-base font-semibold text-text-primary">
              {consultation.patientName}
            </h3>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
          <p className="text-xs font-mono uppercase tracking-wider text-text-muted">{ageLine}</p>
          <p className="text-sm text-text-secondary">
            {consultation.chiefComplaint ?? "No chief complaint on file"}
          </p>
          {isActiveRoom && (
            <p className="text-xs font-mono text-accent-emerald">You are in this consultation room</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <QueueAction {...props} />
      </div>
    </article>
  );
}
