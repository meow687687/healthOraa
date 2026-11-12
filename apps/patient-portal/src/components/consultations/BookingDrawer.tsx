import { useState } from "react";
import { Drawer, DrawerHeader, cn } from "@healthoraa/ui";
import type { PatientIntakeInput } from "@healthoraa/validation";
import { useDoctorSlots } from "../../hooks/useDoctorSlots";
import { useBookConsultation } from "../../hooks/useBookConsultation";
import type { BookingReceipt, DoctorOption, SlotOption } from "../../types/consultations";
import { SlotPicker } from "./booking/SlotPicker";
import { IntakeForm } from "./booking/IntakeForm";
import { PaymentSummary } from "./booking/PaymentSummary";
import { BookingConfirmation } from "./booking/BookingConfirmation";

type Step = "slot" | "intake" | "pay" | "done";

const STEPS: { id: Exclude<Step, "done">; label: string }[] = [
  { id: "slot", label: "Slot" },
  { id: "intake", label: "Intake" },
  { id: "pay", label: "Pay" },
];

const TITLES: Record<Step, string> = {
  slot: "Choose a time",
  intake: "Clinical intake",
  pay: "Review and pay",
  done: "Booking receipt",
};

// Three-step booking flow: slot, intake, then payment. Closing mid-flow discards the draft.
export function BookingDrawer({ doctor, onClose }: { doctor: DoctorOption; onClose: () => void }) {
  const [step, setStep] = useState<Step>("slot");
  const [slot, setSlot] = useState<SlotOption | null>(null);
  const [intake, setIntake] = useState<PatientIntakeInput | null>(null);
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const slots = useDoctorSlots(doctor.id);
  const booking = useBookConsultation();

  const pay = async () => {
    if (!slot || !intake) return;
    try {
      setReceipt(await booking.mutateAsync({ doctor, slot, intake }));
      setStep("done");
    } catch {
      // The error is shown on the payment step, so the draft is kept for a retry.
    }
  };

  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <Drawer isOpen onClose={onClose} labelledBy="booking-title" className="max-w-2xl p-6 md:p-8">
      <DrawerHeader eyebrow={`Book with ${doctor.displayName}`} title={TITLES[step]} titleId="booking-title" onClose={onClose}>
        {step !== "done" && (
          <ol aria-label="Booking progress" className="flex items-center gap-2 pt-1">
            {STEPS.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  aria-current={index === currentIndex ? "step" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider",
                    index <= currentIndex ? "border-accent-blue/40 bg-accent-blue/15 text-accent-blue" : "border-aura-line2 text-text-muted",
                  )}
                >
                  {index + 1}. {item.label}
                </span>
              </li>
            ))}
          </ol>
        )}
      </DrawerHeader>

      <div className="flex-1 py-6">
        {step === "slot" && (
          <SlotPicker
            doctor={doctor}
            slots={slots.data}
            isLoading={slots.isPending}
            selected={slot}
            onSelect={setSlot}
            onContinue={() => setStep("intake")}
          />
        )}
        {step === "intake" && (
          <IntakeForm
            initial={intake}
            onBack={() => setStep("slot")}
            onSubmit={(values) => {
              setIntake(values);
              setStep("pay");
            }}
          />
        )}
        {step === "pay" && slot && intake && (
          <PaymentSummary
            doctor={doctor}
            slot={slot}
            intake={intake}
            isPaying={booking.isPending}
            error={booking.isError ? booking.error.message : null}
            onBack={() => setStep("intake")}
            onPay={pay}
          />
        )}
        {step === "done" && receipt && <BookingConfirmation receipt={receipt} onDone={onClose} />}
      </div>
    </Drawer>
  );
}
