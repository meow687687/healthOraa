import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Badge, EmptyState, PANEL, SkeletonBlock, cn, useToast } from "@healthoraa/ui";
import { useConsultationQueue } from "../../hooks/useConsultationQueue";
import { useStartConsultation } from "../../hooks/useStartConsultation";
import { useDoctor } from "../../context/DoctorContext";
import type { QueueConsultation } from "../../types/queue";
import PrescriptionDrawer from "../consultations/PrescriptionDrawer";
import ConsultationChatDrawer from "../chat/ConsultationChatDrawer";
import { QueueCard } from "./QueueCard";

const LOADING_ROWS = [0, 1, 2];

export default function ConsultationQueueView() {
  const { data, isLoading, refetch } = useConsultationQueue();
  const { activeConsultationId, setActiveConsultationId } = useDoctor();
  const startConsultation = useStartConsultation();
  const toast = useToast();
  const [encounter, setEncounter] = useState<QueueConsultation | null>(null);
  // Bumped on every open so the drawer's form starts from fresh values.
  const [encounterSession, setEncounterSession] = useState(0);
  const [chatConsultation, setChatConsultation] = useState<QueueConsultation | null>(null);

  const queue = data ?? [];
  const inProgress = queue.filter((c) => c.status === "in_progress").length;
  const scheduled = queue.filter((c) => c.status === "scheduled").length;
  const startingId = startConsultation.isPending ? (startConsultation.variables?.id ?? null) : null;

  // Counts every selection. A start that finishes after the doctor picked another visit must not open its own drawer.
  const selectionSeq = useRef(0);

  const openEncounter = (consultation: QueueConsultation) => {
    selectionSeq.current += 1;
    setActiveConsultationId(consultation.id);
    setEncounter(consultation);
    setEncounterSession((n) => n + 1);
  };

  const startAndOpen = async (consultation: QueueConsultation) => {
    const seqAtStart = selectionSeq.current;
    try {
      await startConsultation.mutateAsync(consultation);
      if (selectionSeq.current !== seqAtStart) return;
      openEncounter({ ...consultation, status: "in_progress" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start this consultation.");
    }
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
          <Badge tone="emerald" className="tabular-nums">{inProgress} in progress</Badge>
          <Badge tone="amber" className="tabular-nums">{scheduled} scheduled</Badge>
        </div>
      </section>

      {isLoading && (
        <ul className="space-y-4" aria-busy="true" aria-label="Loading consultation queue">
          {LOADING_ROWS.map((row) => (
            <li key={row}>
              <SkeletonBlock className="h-28 rounded-3xl" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && queue.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No consultations today"
          description="Booked consultations will appear here as patients schedule slots."
          action={{ label: "Refresh queue", onClick: () => void refetch() }}
        />
      )}

      {!isLoading && queue.length > 0 && (
        <ul className="space-y-4" aria-label="Consultation queue">
          {queue.map((consultation) => (
            <li key={consultation.id}>
              <QueueCard
                consultation={consultation}
                isActiveRoom={activeConsultationId === consultation.id}
                isStarting={startingId === consultation.id}
                onStart={startAndOpen}
                onOpenEncounter={openEncounter}
                onOpenChat={setChatConsultation}
              />
            </li>
          ))}
        </ul>
      )}

      <ConsultationChatDrawer consultation={chatConsultation} onClose={() => setChatConsultation(null)} />

      <PrescriptionDrawer
        consultation={encounter}
        sessionKey={encounterSession}
        onClose={() => setEncounter(null)}
        onSigned={() => {
          setEncounter(null);
          toast.success("Prescription signed and issued to patient portal");
        }}
      />
    </div>
  );
}
