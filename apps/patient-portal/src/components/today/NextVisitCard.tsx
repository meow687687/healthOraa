import { CalendarClock } from "lucide-react";
import { BTN_PRIMARY, PANEL, cn } from "@healthoraa/ui";
import { usePatientConsultations } from "../../hooks/usePatientConsultations";
import type { ConsultationItem } from "../../types/consultations";

const hasEnded = (item: ConsultationItem, now: number): boolean => Date.parse(item.endsAt) <= now;

// The patient's next confirmed visit: the earliest one that has not ended yet.
const nextVisit = (items: ConsultationItem[], now: number): ConsultationItem | null =>
  items
    .filter((item) => item.state === "confirmed" && !hasEnded(item, now))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null;

// A booking that is still waiting for payment or for the device to sync. It is not confirmed yet.
const pendingBooking = (items: ConsultationItem[], now: number): ConsultationItem | null =>
  items.find((item) => (item.state === "awaiting_payment" || item.state === "held_on_device") && !hasEnded(item, now)) ?? null;

const timeLabel = (visit: ConsultationItem, now: number): string => {
  const start = Date.parse(visit.startsAt);
  if (start <= now) return "In progress";
  const minutes = Math.round((start - now) / 60_000);
  if (minutes < 60) return `Starts in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `Starts in about ${hours} ${hours === 1 ? "hour" : "hours"}`;
};

export function NextVisitCard({ onOpen, now }: { onOpen: () => void; now: number }) {
  const query = usePatientConsultations();
  const items = query.data ?? [];
  const visit = query.data ? nextVisit(items, now) : null;
  const pending = !visit && query.data ? pendingBooking(items, now) : null;

  return (
    <section aria-labelledby="next-visit-title" className={cn(PANEL, "flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6")}>
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-aura-line bg-aura-s2 text-accent-blue">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <p id="next-visit-title" className="text-[13px] font-semibold text-text-muted">Next visit</p>
          {query.isPending ? (
            <p className="text-sm text-text-secondary">Loading your visits...</p>
          ) : visit ? (
            <>
              <p className="text-base font-semibold text-text-primary">{visit.doctorName}</p>
              <p className="text-sm text-text-secondary">{timeLabel(visit, now)}</p>
            </>
          ) : pending ? (
            <>
              <p className="text-base font-semibold text-text-primary">Booking awaiting confirmation</p>
              <p className="text-sm text-text-secondary">{pending.doctorName}. The visit is confirmed once payment is verified.</p>
            </>
          ) : query.isError ? (
            <>
              <p className="text-base font-semibold text-text-primary">Visits could not load</p>
              <p className="text-sm text-text-secondary">Try again in a moment.</p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-text-primary">No visit booked</p>
              <p className="text-sm text-text-secondary">Book a consultation with a doctor when you need one.</p>
            </>
          )}
        </div>
      </div>
      {!query.isPending && (
        <button type="button" onClick={onOpen} className={cn(BTN_PRIMARY, "min-h-[44px] shrink-0 px-5 py-2.5")}>
          {visit ? "Open visit" : pending ? "Review booking" : "Book a visit"}
        </button>
      )}
    </section>
  );
}
