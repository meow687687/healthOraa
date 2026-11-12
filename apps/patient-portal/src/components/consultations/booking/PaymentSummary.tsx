import { BTN_PRIMARY, LABEL, cn } from "@healthoraa/ui";
import { formatIstDateTime } from "../../../lib/istTime";
import { formatPaise, gstOn, rupeesToPaise } from "../../../lib/money";
import type { DoctorOption, SlotOption } from "../../../types/consultations";
import type { PatientIntakeInput } from "@healthoraa/validation";

export function PaymentSummary({
  doctor,
  slot,
  intake,
  isPaying,
  error,
  onBack,
  onPay,
}: {
  doctor: DoctorOption;
  slot: SlotOption;
  intake: PatientIntakeInput;
  isPaying: boolean;
  error: string | null;
  onBack: () => void;
  onPay: () => void;
}) {
  const feePaise = rupeesToPaise(doctor.feeInr);
  const gstPaise = gstOn(feePaise);
  const totalPaise = feePaise + gstPaise;

  const row = (label: string, value: string, emphasis = false) => (
    <div className={cn("flex items-center justify-between gap-4 py-2.5", emphasis && "border-t border-aura-line pt-4")}>
      <span className={cn("text-sm", emphasis ? "font-semibold text-text-primary" : "text-text-secondary")}>{label}</span>
      <span className={cn("font-mono tabular-nums", emphasis ? "text-lg font-bold text-white" : "text-sm text-text-primary")}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-aura-line bg-aura-s2 p-5">
        <p className={LABEL}>Appointment</p>
        <p className="text-sm font-semibold text-text-primary">{doctor.displayName}</p>
        <p className="font-mono text-xs text-text-secondary">{formatIstDateTime(slot.startsAt)} IST</p>
        <p className="text-xs text-text-muted line-clamp-2">Concern: {intake.chief_complaint}</p>
      </section>

      <section aria-labelledby="breakdown-title" className="rounded-2xl border border-aura-line bg-aura-s2 px-5">
        <p id="breakdown-title" className={cn(LABEL, "pt-5")}>
          Amount breakdown
        </p>
        <div className="divide-y divide-aura-line">
          {row("Consultation fee", formatPaise(feePaise))}
          {row("Platform GST (18%)", formatPaise(gstPaise))}
          {row("Total amount", formatPaise(totalPaise), true)}
        </div>
      </section>

      <p className="text-xs text-text-muted">
        Mock checkout. No money is charged in this prototype, and the payment is not verified by a payment gateway.
      </p>

      {error && <p className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-xs text-accent-red">{error}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-aura-line pt-5">
        <button type="button" disabled={isPaying} onClick={onBack} className="rounded-full px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-50">
          Back
        </button>
        <button type="button" disabled={isPaying} onClick={onPay} className={BTN_PRIMARY}>
          {isPaying ? "Opening Razorpay..." : "Proceed to Pay with Razorpay"}
        </button>
      </div>
    </div>
  );
}
