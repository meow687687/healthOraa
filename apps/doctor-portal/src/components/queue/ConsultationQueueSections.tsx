import { CalendarDays } from "lucide-react";
import { EmptyState, SkeletonBlock } from "@healthoraa/ui";
import type { QueueConsultation, RoomPane } from "../../types/queue";
import { QueueCard } from "./QueueCard";
import { UpNextCard } from "./UpNextCard";

const LOADING_ROWS = [0, 1, 2];

interface ConsultationQueueSectionsProps {
  consultations: QueueConsultation[];
  isLoading: boolean;
  now: number;
  isActiveRoom: (id: string) => boolean;
  isStarting: (id: string) => boolean;
  onStart: (consultation: QueueConsultation) => void;
  onOpenRoom: (consultation: QueueConsultation, pane: RoomPane) => void;
  onRefresh: () => void;
}

export function ConsultationQueueSections({
  consultations,
  isLoading,
  now,
  isActiveRoom,
  isStarting,
  onStart,
  onOpenRoom,
  onRefresh,
}: ConsultationQueueSectionsProps) {
  const upNext =
    consultations.find((item) => item.status === "in_progress") ??
    consultations.find((item) => item.status === "scheduled") ??
    null;
  const later = consultations.filter(
    (item) =>
      item !== upNext &&
      (item.status === "scheduled" || item.status === "in_progress"),
  );
  const done = consultations.filter(
    (item) => item.status === "completed" || item.status === "cancelled",
  );

  return (
    <>
      {isLoading && (
        <ul
          className="space-y-4"
          aria-busy="true"
          aria-label="Loading consultation queue"
        >
          {LOADING_ROWS.map((row) => (
            <li key={row}>
              <SkeletonBlock className="h-28 rounded-3xl" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && consultations.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No consultations today"
          description="Booked consultations will appear here as patients schedule slots."
          action={{ label: "Refresh queue", onClick: onRefresh }}
        />
      )}

      {!isLoading && upNext && (
        <UpNextCard
          now={now}
          consultation={upNext}
          isActiveRoom={isActiveRoom(upNext.id)}
          isStarting={isStarting(upNext.id)}
          onStart={onStart}
          onOpenRoom={onOpenRoom}
        />
      )}

      {!isLoading && later.length > 0 && (
        <section aria-labelledby="later-today" className="space-y-3">
          <h2
            id="later-today"
            className="text-[13px] font-semibold text-text-muted"
          >
            Later today
          </h2>
          <ul className="space-y-4" aria-label="Later today">
            {later.map((consultation) => (
              <li key={consultation.id}>
                <QueueCard
                  consultation={consultation}
                  isActiveRoom={isActiveRoom(consultation.id)}
                  isStarting={isStarting(consultation.id)}
                  onStart={onStart}
                  onOpenRoom={onOpenRoom}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isLoading && done.length > 0 && (
        <section aria-labelledby="done-today" className="space-y-3">
          <h2
            id="done-today"
            className="text-[13px] font-semibold text-text-muted"
          >
            Done today ({done.length})
          </h2>
          <ul className="space-y-3" aria-label="Done today">
            {done.map((consultation) => (
              <li key={consultation.id}>
                <QueueCard
                  compact
                  consultation={consultation}
                  isActiveRoom={isActiveRoom(consultation.id)}
                  isStarting={isStarting(consultation.id)}
                  onStart={onStart}
                  onOpenRoom={onOpenRoom}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
