import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Badge, EmptyState, PANEL, SkeletonBlock, cn, useToast } from "@healthoraa/ui";
import { useConsultationQueue } from "../../hooks/useConsultationQueue";
import { useStartConsultation } from "../../hooks/useStartConsultation";
import { useDoctor } from "../../context/DoctorContext";
import type { QueueConsultation, RoomPane } from "../../types/queue";
import { ConsultationRoom } from "../room/ConsultationRoom";
import { QueueCard } from "./QueueCard";
import { UpNextCard } from "./UpNextCard";

const LOADING_ROWS = [0, 1, 2];

// Re-renders every 30 seconds so the countdowns stay current.
const useNow = (): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

interface OpenRoom {
  consultation: QueueConsultation;
  pane: RoomPane;
  // Bumped on every open, so the room starts from fresh form state.
  session: number;
}

export default function ConsultationQueueView() {
  const { data, isLoading, refetch } = useConsultationQueue();
  const { activeConsultationId, setActiveConsultationId } = useDoctor();
  const startConsultation = useStartConsultation();
  const toast = useToast();
  const now = useNow();
  const [room, setRoom] = useState<OpenRoom | null>(null);

  const queue = data ?? [];
  const inProgress = queue.filter((c) => c.status === "in_progress").length;
  const scheduled = queue.filter((c) => c.status === "scheduled").length;
  // The next patient is the one in the room, else the earliest scheduled.
  const upNext = queue.find((c) => c.status === "in_progress") ?? queue.find((c) => c.status === "scheduled") ?? null;
  const later = queue.filter((c) => c !== upNext && (c.status === "scheduled" || c.status === "in_progress"));
  const done = queue.filter((c) => c.status === "completed" || c.status === "cancelled");
  const startingId = startConsultation.isPending ? (startConsultation.variables?.id ?? null) : null;

  const openRoom = (consultation: QueueConsultation, pane: RoomPane) => {
    setActiveConsultationId(consultation.id);
    setRoom((current) => ({ consultation, pane, session: (current?.session ?? 0) + 1 }));
  };

  const startAndOpen = async (consultation: QueueConsultation) => {
    try {
      await startConsultation.mutateAsync(consultation);
      openRoom({ ...consultation, status: "in_progress" }, "rx");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start this consultation.");
    }
  };

  if (room) {
    return (
      <ConsultationRoom
        key={`${room.consultation.id}-${room.session}`}
        consultation={room.consultation}
        initialPane={room.pane}
        now={now}
        onExit={() => setRoom(null)}
        onSigned={() => {
          setRoom(null);
          toast.success("Prescription signed and issued to patient portal");
        }}
      />
    );
  }

  const cardProps = {
    isStarting: (id: string) => startingId === id,
    isActiveRoom: (id: string) => activeConsultationId === id,
    onStart: startAndOpen,
    onOpenRoom: openRoom,
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

      {!isLoading && upNext && (
        <UpNextCard
          now={now}
          consultation={upNext}
          isActiveRoom={cardProps.isActiveRoom(upNext.id)}
          isStarting={cardProps.isStarting(upNext.id)}
          onStart={cardProps.onStart}
          onOpenRoom={cardProps.onOpenRoom}
        />
      )}

      {!isLoading && later.length > 0 && (
        <section aria-labelledby="later-today" className="space-y-3">
          <h2 id="later-today" className="text-[13px] font-semibold text-text-muted">Later today</h2>
          <ul className="space-y-4" aria-label="Later today">
            {later.map((consultation) => (
              <li key={consultation.id}>
                <QueueCard
                  consultation={consultation}
                  isActiveRoom={cardProps.isActiveRoom(consultation.id)}
                  isStarting={cardProps.isStarting(consultation.id)}
                  onStart={cardProps.onStart}
                  onOpenRoom={cardProps.onOpenRoom}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isLoading && done.length > 0 && (
        <section aria-labelledby="done-today" className="space-y-3">
          <h2 id="done-today" className="text-[13px] font-semibold text-text-muted">Done today ({done.length})</h2>
          <ul className="space-y-3" aria-label="Done today">
            {done.map((consultation) => (
              <li key={consultation.id}>
                <QueueCard
                  compact
                  consultation={consultation}
                  isActiveRoom={cardProps.isActiveRoom(consultation.id)}
                  isStarting={cardProps.isStarting(consultation.id)}
                  onStart={cardProps.onStart}
                  onOpenRoom={cardProps.onOpenRoom}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
