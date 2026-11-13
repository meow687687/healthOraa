import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { watchTables, withSingleFallback } from "@healthoraa/ui";
import type { Enums } from "@healthoraa/types";
import { supabase } from "../lib/supabase";
import { usePatient } from "../context/PatientContext";
import { buildFallbackConsultations } from "../lib/consultationFallback";
import { readDeviceBookings } from "../lib/deviceBookingStore";
import type { ConsultationItem, ConsultationState, DeviceBooking, PrescriptionRecord } from "../types/consultations";

export const patientConsultationsKey = (patientId: string) => ["consultations", "patient", patientId] as const;

interface MedicineRow {
  name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string | null;
}

interface ConsultationRow {
  id: string;
  followup_expires_at: string | null;
  slot_start: string;
  slot_end: string;
  status: Enums<"consultation_status">;
  booking_status: Enums<"booking_status">;
  chief_complaint: string | null;
  profiles: { full_name: string } | null;
  prescriptions: {
    id: string;
    diagnosis: string;
    followup_days: number;
    created_at: string;
    prescription_medicines: MedicineRow[];
  }[];
}

const stateFor = (status: Enums<"consultation_status">, bookingStatus: Enums<"booking_status">): ConsultationState => {
  if (status === "cancelled" || bookingStatus === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (bookingStatus === "pending_payment") return "awaiting_payment";
  return "confirmed";
};

const toItem = (row: ConsultationRow): ConsultationItem => {
  // A re-signed prescription is a new row, so take the newest one by time.
  const latest = [...row.prescriptions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const prescription: PrescriptionRecord | null = latest
    ? {
        id: latest.id,
        doctorName: row.profiles?.full_name ?? "Your doctor",
        issuedAt: latest.created_at,
        diagnosis: latest.diagnosis,
        followupDays: latest.followup_days,
        medicines: latest.prescription_medicines.map((medicine) => ({
          name: medicine.name,
          dosage: medicine.dosage,
          frequency: medicine.frequency,
          durationDays: medicine.duration_days,
          instructions: medicine.instructions,
        })),
      }
    : null;

  return {
    id: row.id,
    state: stateFor(row.status, row.booking_status),
    doctorName: row.profiles?.full_name ?? "Your doctor",
    startsAt: row.slot_start,
    endsAt: row.slot_end,
    chiefComplaint: row.chief_complaint,
    reference: `HLX-${row.id.slice(0, 6).toUpperCase()}`,
    prescription,
    followupExpiresAt: row.followup_expires_at,
  };
};

const fromDeviceBooking = (booking: DeviceBooking): ConsultationItem => ({
  id: `device-${booking.reference}`,
  state: "held_on_device",
  doctorName: booking.doctorName,
  startsAt: booking.startsAt,
  endsAt: booking.endsAt,
  chiefComplaint: booking.chiefComplaint,
  reference: booking.reference,
  prescription: null,
  followupExpiresAt: null,
});

// Patient's consultations with their prescriptions, plus bookings held on this device.
export const usePatientConsultations = () => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  // Realtime: status transitions on this patient's consultations and newly issued
  // prescriptions refetch the list at once.
  useEffect(
    () =>
      watchTables(supabase, `patient-consultations:${patient.id}`, [
        { table: "consultations", events: ["UPDATE"], filter: `patient_id=eq.${patient.id}` },
        { table: "prescriptions", events: ["INSERT"], filter: `patient_id=eq.${patient.id}` },
      ], () => {
        void queryClient.invalidateQueries({ queryKey: patientConsultationsKey(patient.id) });
      }),
    [patient.id, queryClient],
  );

  return useQuery<ConsultationItem[], Error>({
    queryKey: patientConsultationsKey(patient.id),
    queryFn: async () => {
      const server = await withSingleFallback(
        async () => {
          const { data, error } = await supabase
            .from("consultations")
            .select(
              "id, slot_start, slot_end, status, booking_status, chief_complaint, followup_expires_at, profiles!consultations_doctor_id_fkey(full_name), prescriptions(id, diagnosis, followup_days, created_at, prescription_medicines(name, dosage, frequency, duration_days, instructions))",
            )
            .eq("patient_id", patient.id)
            .order("slot_start", { ascending: false });
          if (error) throw new Error(error.message);
          return ((data ?? []) as unknown as ConsultationRow[]).map(toItem);
        },
        buildFallbackConsultations(new Date()),
        "consultations",
      );
      const device = readDeviceBookings().map(fromDeviceBooking);
      return [...device, ...server].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
    },
  });
};
