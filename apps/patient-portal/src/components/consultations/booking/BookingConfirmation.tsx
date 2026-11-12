import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { BTN_PRIMARY, Badge, LABEL, cn } from "@healthoraa/ui";
import { buildAppointmentIcs, downloadIcs } from "../../../lib/calendar";
import { formatIstDateTime } from "../../../lib/istTime";
import { formatPaise } from "../../../lib/money";
import type { BookingReceipt } from "../../../types/consultations";

export function BookingConfirmation({ receipt, onDone }: { receipt: BookingReceipt; onDone: () => void }) {
  const onHeld = receipt.state === "held_on_device";

  const addToCalendar = () =>
    downloadIcs(
      buildAppointmentIcs({
        reference: receipt.reference,
        summary: `Consultation with ${receipt.doctorName}`,
        description: `Booking reference ${receipt.reference}. Join from the Healthoraa patient app.`,
        startsAt: receipt.startsAt,
        endsAt: receipt.endsAt,
      }),
      `${receipt.reference}.ics`,
    );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className={cn("rounded-full border p-2.5", onHeld ? "border-accent-amber/30 bg-accent-amber/10 text-accent-amber" : "border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald")}>
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold tracking-tight text-white">{onHeld ? "Booking held on this device" : "Booking received"}</h3>
          <Badge tone={onHeld ? "amber" : "emerald"}>{onHeld ? "Not sent to the clinic" : "Awaiting payment verification"}</Badge>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-aura-line bg-aura-s2 p-5">
        <div>
          <p className={LABEL}>Reference</p>
          <p className="font-mono text-sm font-semibold text-text-primary">{receipt.reference}</p>
        </div>
        <div>
          <p className={LABEL}>Doctor</p>
          <p className="text-sm text-text-primary">{receipt.doctorName}</p>
        </div>
        <div>
          <p className={LABEL}>When (IST)</p>
          <p className="font-mono text-sm text-text-primary">{formatIstDateTime(receipt.startsAt)}</p>
        </div>
        <div>
          <p className={LABEL}>Amount</p>
          <p className="font-mono text-sm text-text-primary">{formatPaise(receipt.totalPaise)} (includes GST)</p>
        </div>
      </section>

      {receipt.notice && (
        <p className="rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-xs text-accent-amber">{receipt.notice}</p>
      )}

      <div className="flex flex-col gap-3 border-t border-aura-line pt-5 sm:flex-row sm:justify-between">
        <button type="button" onClick={addToCalendar} className="inline-flex items-center justify-center gap-2 rounded-full border border-aura-line2 bg-aura-s3 px-5 py-2.5 text-xs font-semibold text-text-primary hover:bg-aura-s2">
          <CalendarPlus className="h-4 w-4" />
          Add to calendar
        </button>
        <button type="button" onClick={onDone} className={BTN_PRIMARY}>
          Done
        </button>
      </div>
    </div>
  );
}
