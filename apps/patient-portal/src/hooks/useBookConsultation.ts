import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patientIntakeSchema } from "@healthoraa/validation";
import type { PatientIntakeInput } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";
import { usePatient } from "../context/PatientContext";
import { appendDeviceBooking } from "../lib/deviceBookingStore";
import { gstOn, rupeesToPaise } from "../lib/money";
import type { BookingReceipt, BookingRequest, DeviceBooking } from "../types/consultations";

// Simulated Razorpay checkout delay. Mock checkout: no money moves.
export const CHECKOUT_DELAY_MS = 800;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const newReference = (): string => `HLX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

type ServerOutcome =
  | { ok: true; reference: string; notice: string | null }
  | { ok: false; reason: string };

// Calls initiate_consultation_booking, which requires a signed-in patient. Anonymous calls are refused.
const bookOnServer = async (
  patientId: string,
  slotId: string,
  intake: PatientIntakeInput,
  totalRupees: number,
): Promise<ServerOutcome> => {
  const { data, error } = await supabase.rpc("initiate_consultation_booking", {
    p_slot_id: slotId,
    p_patient_id: patientId,
    p_chief_complaint: intake.chief_complaint,
    p_fee: totalRupees,
  });
  if (error) return { ok: false, reason: error.message };

  const row = data?.[0];
  if (!row) return { ok: false, reason: "The booking service returned no consultation." };

  const { error: intakeError } = await supabase.from("patient_intake_forms").insert({
    patient_id: patientId,
    consultation_id: row.consultation_row.id,
    age: intake.age,
    gender: intake.gender,
    chief_complaint: intake.chief_complaint,
    symptoms_duration: intake.symptoms_duration,
    known_allergies: intake.known_allergies ?? [],
    current_medications: intake.current_medications ?? [],
  });

  return {
    ok: true,
    reference: row.order_id,
    notice: intakeError ? `The intake form did not reach the clinic: ${intakeError.message}` : null,
  };
};

const noticeFor = (reason: string | null): string =>
  reason === null
    ? "This is a demo slot, so the booking is held on this device only."
    : `The clinic did not take this booking (${reason}). It is held on this device and has not been sent.`;

// Runs the mock checkout, then books. Live slots go to the server; demo slots and refused bookings are held on this device.
export const useBookConsultation = () => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<BookingReceipt, Error, BookingRequest>({
    mutationFn: async ({ doctor, slot, intake: rawIntake }) => {
      const parsed = patientIntakeSchema.safeParse(rawIntake);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the intake form.");
      const intake = parsed.data;

      await wait(CHECKOUT_DELAY_MS);

      const feePaise = rupeesToPaise(doctor.feeInr);
      const gstPaise = gstOn(feePaise);
      const totalPaise = feePaise + gstPaise;
      const common = {
        doctorName: doctor.displayName,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        feePaise,
        gstPaise,
        totalPaise,
      };

      let reason: string | null = null;
      if (slot.source === "live") {
        const outcome = await bookOnServer(patient.id, slot.id, intake, totalPaise / 100);
        if (outcome.ok) {
          return { ...common, reference: outcome.reference, state: "awaiting_payment", notice: outcome.notice };
        }
        reason = outcome.reason;
      }

      const reference = newReference();
      const booking: DeviceBooking = {
        reference,
        slotId: slot.id,
        doctorId: doctor.id,
        doctorName: doctor.displayName,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        totalPaise,
        chiefComplaint: intake.chief_complaint,
        intake,
        createdAt: new Date().toISOString(),
      };
      appendDeviceBooking(booking);
      return { ...common, reference, state: "held_on_device", notice: noticeFor(reason) };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["consultations"] }),
  });
};
