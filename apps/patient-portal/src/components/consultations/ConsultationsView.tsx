import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { ERROR_BOX, LABEL, PANEL, cn } from "@healthoraa/ui";
import { useDoctors } from "../../hooks/useDoctors";
import { usePatientConsultations } from "../../hooks/usePatientConsultations";
import { useNow } from "../../hooks/useNow";
import type { ConsultationItem, DoctorOption } from "../../types/consultations";
import { UpcomingCard } from "./UpcomingCard";
import { DoctorCard } from "./DoctorCard";
import { PastConsultations } from "./PastConsultations";
import { RxPreviewModal } from "./RxPreviewModal";
import { BookingDrawer } from "./BookingDrawer";

const OPEN_STATES: ConsultationItem["state"][] = ["awaiting_payment", "confirmed", "held_on_device"];

export default function ConsultationsView() {
  const now = useNow(30_000);
  const consultations = usePatientConsultations();
  const doctors = useDoctors();
  const [bookingWith, setBookingWith] = useState<DoctorOption | null>(null);
  const [rxFor, setRxFor] = useState<ConsultationItem | null>(null);

  const items = consultations.data ?? [];
  const upcoming = items
    .filter((item) => OPEN_STATES.includes(item.state) && Date.parse(item.endsAt) > now.getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const next = upcoming[0] ?? null;
  const history = items.filter((item) => item !== next);

  return (
    <div className="space-y-10">
      <section aria-label="Upcoming consultation">
        {consultations.isPending ? (
          <p className="py-10 text-center text-sm text-text-secondary">Loading your consultations...</p>
        ) : next ? (
          <UpcomingCard item={next} />
        ) : (
          <div className={cn(PANEL, "flex flex-col items-center gap-3 py-10 text-center")}>
            <div className="rounded-full border border-accent-blue/20 bg-accent-blue/10 p-3 text-accent-blue">
              <Stethoscope className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-text-primary">No consultation booked</p>
            <p className="max-w-sm text-xs text-text-secondary">Choose a doctor below and pick a time that suits you.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="discovery-title" className="space-y-4">
        <div>
          <p className={LABEL}>Doctor discovery</p>
          <h2 id="discovery-title" className="mt-1 text-base font-semibold text-text-primary">
            Find a doctor
          </h2>
        </div>
        {doctors.isPending ? (
          <p className="text-sm text-text-secondary">Loading doctors...</p>
        ) : (doctors.data ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">No doctors are accepting consultations right now.</p>
        ) : (
          <div className="space-y-3">
            {(doctors.data ?? []).map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} onBook={() => setBookingWith(doctor)} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="history-title" className="space-y-4">
        <div>
          <p className={LABEL}>History</p>
          <h2 id="history-title" className="mt-1 text-base font-semibold text-text-primary">
            Past consultations and prescriptions
          </h2>
        </div>
        {consultations.isError && <div className={ERROR_BOX}>Could not load your history.</div>}
        {!consultations.isPending && <PastConsultations items={history} onOpenRx={setRxFor} />}
      </section>

      {bookingWith && <BookingDrawer key={bookingWith.id} doctor={bookingWith} onClose={() => setBookingWith(null)} />}
      {rxFor?.prescription && <RxPreviewModal prescription={rxFor.prescription} onClose={() => setRxFor(null)} />}
    </div>
  );
}
