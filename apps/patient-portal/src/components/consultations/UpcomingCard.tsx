import { useState } from "react";
import { CalendarPlus, Video } from "lucide-react";
import { BTN_PRIMARY, Badge, LABEL, PANEL, cn } from "@healthoraa/ui";
import { useNow } from "../../hooks/useNow";
import { buildAppointmentIcs, downloadIcs } from "../../lib/calendar";
import { formatIstDateTime } from "../../lib/istTime";
import type { ConsultationItem, ConsultationState } from "../../types/consultations";

const JOIN_WINDOW_MS = 10 * 60_000;
const pad = (value: number): string => String(value).padStart(2, "0");

// "2d 04h 12m 09s" when more than a day away, "04:12:09" inside a day, "Starting now" once it has begun.
export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return "Starting now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days > 0 ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const STATE_BADGE: Record<ConsultationState, { tone: "emerald" | "amber" | "neutral"; label: string }> = {
  confirmed: { tone: "emerald", label: "Confirmed" },
  awaiting_payment: { tone: "amber", label: "Awaiting payment verification" },
  held_on_device: { tone: "amber", label: "Held on this device" },
  completed: { tone: "neutral", label: "Completed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function UpcomingCard({ item }: { item: ConsultationItem }) {
  const now = useNow();
  const remaining = Date.parse(item.startsAt) - now.getTime();
  const joinOpen = remaining <= JOIN_WINDOW_MS && now.getTime() < Date.parse(item.endsAt);
  const [joinNote, setJoinNote] = useState(false);
  const badge = STATE_BADGE[item.state];

  return (
    <section aria-labelledby="upcoming-title" className={cn(PANEL, "space-y-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className={LABEL}>Next consultation</p>
          <h2 id="upcoming-title" className="text-xl font-bold tracking-tight text-white">
            {item.doctorName}
          </h2>
          <p className="font-mono text-xs text-text-secondary">{formatIstDateTime(item.startsAt)} IST · {item.reference}</p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <div className="space-y-1">
        <p className={LABEL}>Starts in</p>
        <p role="timer" className="font-mono text-3xl font-bold tabular-nums text-white">
          {formatCountdown(remaining)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!joinOpen}
          onClick={() => setJoinNote(true)}
          className={BTN_PRIMARY}
        >
          <Video className="h-4 w-4" />
          Join Call
        </button>
        <button
          type="button"
          onClick={() =>
            downloadIcs(
              buildAppointmentIcs({
                reference: item.reference,
                summary: `Consultation with ${item.doctorName}`,
                description: `Booking reference ${item.reference}.`,
                startsAt: item.startsAt,
                endsAt: item.endsAt,
              }),
              `${item.reference}.ics`,
            )
          }
          className="inline-flex items-center gap-2 rounded-full border border-aura-line2 bg-aura-s3 px-4 py-2.5 text-xs font-semibold text-text-primary hover:bg-aura-s2"
        >
          <CalendarPlus className="h-4 w-4" />
          Add to calendar
        </button>
      </div>

      {joinNote ? (
        <p className="text-xs text-text-secondary">The video room opens here once telemedicine is connected.</p>
      ) : (
        <p className="text-xs text-text-muted">
          {joinOpen ? "Your room is open." : "Join Call opens 10 minutes before your slot."}
        </p>
      )}
    </section>
  );
}
