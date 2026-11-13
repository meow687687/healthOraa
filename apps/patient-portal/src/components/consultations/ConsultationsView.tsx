import { useRef, useState } from "react";
import { Stethoscope } from "lucide-react";
import { ERROR_BOX, EmptyState, LABEL } from "@healthoraa/ui";
import { useDoctors } from "../../hooks/useDoctors";
import { usePatientConsultations } from "../../hooks/usePatientConsultations";
import { useNow } from "../../hooks/useNow";
import type { ConsultationItem, DoctorOption } from "../../types/consultations";
import { UpcomingCard } from "./UpcomingCard";
import { DoctorCard } from "./DoctorCard";
import { PastConsultations } from "./PastConsultations";
import { RxPreviewModal } from "./RxPreviewModal";
import { FollowupChatDrawer } from "../chat/FollowupChatDrawer";
import { BookingDrawer } from "./BookingDrawer";

const OPEN_STATES: ConsultationItem["state"][] = ["awaiting_payment", "confirmed", "held_on_device"];

export default function ConsultationsView() {
  const now = useNow(30_000);
  const consultations = usePatientConsultations();
  const doctors = useDoctors();
  const discoveryRef = useRef<HTMLElement>(null);
  const findDoctor = () => discoveryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const [bookingWith, setBookingWith] = useState<DoctorOption | null>(null);
  const [rxFor, setRxFor] = useState<ConsultationItem | null>(null);
  const [chatFor, setChatFor] = useState<ConsultationItem | null>(null);

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
          <EmptyState
            icon={Stethoscope}
            title="No consultation booked"
            description="Choose a doctor below and pick a time that suits you."
            action={{ label: "Book a visit", onClick: findDoctor }}
          />
        )}
      </section>

      <section ref={discoveryRef} aria-labelledby="discovery-title" className="space-y-4">
        <div>
          <p className={LABEL}>Doctors</p>
          <h2 id="discovery-title" className="mt-1 text-base font-semibold text-text-primary">
            Book a visit
          </h2>
        </div>
        {doctors.isPending ? (
          <p className="text-sm text-text-secondary">Loading doctors...</p>
        ) : (doctors.data ?? []).length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No doctors are accepting consultations right now"
            description="Verified doctors appear here when they open slots. Check again shortly."
            action={{ label: "Refresh doctors", onClick: () => void doctors.refetch() }}
          />
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
        {!consultations.isPending && <PastConsultations items={history} onOpenRx={setRxFor} onOpenChat={setChatFor} />}
      </section>

      {bookingWith && <BookingDrawer key={bookingWith.id} doctor={bookingWith} onClose={() => setBookingWith(null)} />}
      {rxFor?.prescription && <RxPreviewModal prescription={rxFor.prescription} onClose={() => setRxFor(null)} />}
      {chatFor && <FollowupChatDrawer key={chatFor.id} item={chatFor} onClose={() => setChatFor(null)} />}
    </div>
  );
}
