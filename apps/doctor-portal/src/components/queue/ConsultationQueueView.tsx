import { useState } from "react";
import { Badge, PANEL, cn } from "@healthoraa/ui";
import { useConsultationQueue } from "../../hooks/useConsultationQueue";
import { useDoctor } from "../../context/DoctorContext";
import type { QueueConsultation } from "../../types/queue";
import PrescriptionDrawer from "../consultations/PrescriptionDrawer";
import ConsultationChatDrawer from "../chat/ConsultationChatDrawer";
import { QueueCard } from "./QueueCard";

export default function ConsultationQueueView() {
  const { data, isLoading } = useConsultationQueue();
  const { activeConsultationId, setActiveConsultationId } = useDoctor();
  const [encounter, setEncounter] = useState<QueueConsultation | null>(null);
  // Bumped on every open so the drawer's form starts from fresh values.
  const [encounterSession, setEncounterSession] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatConsultation, setChatConsultation] = useState<QueueConsultation | null>(null);

  const queue = data ?? [];
  const inProgress = queue.filter((c) => c.status === "in_progress").length;
  const scheduled = queue.filter((c) => c.status === "scheduled").length;

  const openEncounter = (consultation: QueueConsultation) => {
    setActiveConsultationId(consultation.id);
    setNotice(null);
    setEncounter(consultation);
    setEncounterSession((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <section className={cn(PANEL, "flex flex-wrap items-center justify-between gap-4")}>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Today&apos;s Queue</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {isLoading ? "Loading consultations..." : `${queue.length} consultation${queue.length === 1 ? "" : "s"} today`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="emerald">{inProgress} in progress</Badge>
          <Badge tone="amber">{scheduled} scheduled</Badge>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent-emerald/30 bg-accent-emerald/10 px-4 py-3 text-sm text-accent-emerald"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-full px-2 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isLoading && queue.length === 0 && (
        <div className={cn(PANEL, "flex flex-col items-center gap-2 py-16 text-center")}>
          <p className="text-sm font-semibold text-text-primary">No consultations today</p>
          <p className="text-xs text-text-muted">Booked consultations will appear here as patients schedule slots.</p>
        </div>
      )}

      <ul className="space-y-4" aria-label="Consultation queue">
        {queue.map((consultation) => (
          <li key={consultation.id}>
            <QueueCard
              consultation={consultation}
              isActiveRoom={activeConsultationId === consultation.id}
              onOpenEncounter={openEncounter}
              onOpenChat={setChatConsultation}
            />
          </li>
        ))}
      </ul>

      <ConsultationChatDrawer consultation={chatConsultation} onClose={() => setChatConsultation(null)} />

      <PrescriptionDrawer
        consultation={encounter}
        sessionKey={encounterSession}
        onClose={() => setEncounter(null)}
        onSigned={() => {
          setEncounter(null);
          setNotice("Prescription signed and issued to patient portal");
        }}
      />
    </div>
  );
}
