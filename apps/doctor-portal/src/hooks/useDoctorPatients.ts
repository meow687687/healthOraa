import { useQuery } from "@tanstack/react-query";
import { withFallback } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import { useDoctor } from "../context/DoctorContext";
import { FALLBACK_PATIENTS } from "../lib/patientFallback";
import type { PatientPrescription, PatientRecord, PatientVisit } from "../types/patients";
import type { ConsultationStatus } from "../types/queue";

export const patientsKey = (doctorId: string) => ["patients", doctorId] as const;

interface ConsultationRow {
  id: string;
  patient_id: string;
  slot_start: string;
  status: ConsultationStatus;
  chief_complaint: string | null;
  profiles: { full_name: string; phone: string | null } | null;
}

interface PrescriptionRow {
  id: string;
  consultation_id: string;
  patient_id: string;
  diagnosis: string;
  clinical_notes: string | null;
  followup_days: number;
  created_at: string;
  prescription_medicines: {
    name: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    instructions: string | null;
  }[];
}

// Groups this doctor's consultations by patient and attaches each patient's prescriptions.
// Fields the database does not store stay null or empty.
export const composeLivePatients = (
  consultations: ConsultationRow[],
  prescriptions: PrescriptionRow[],
): PatientRecord[] => {
  const byPatient = new Map<string, ConsultationRow[]>();
  for (const consultation of consultations) {
    byPatient.set(consultation.patient_id, [...(byPatient.get(consultation.patient_id) ?? []), consultation]);
  }

  return [...byPatient.entries()].map(([patientId, rows]) => {
    const visitsInOrder = [...rows].sort((a, b) => a.slot_start.localeCompare(b.slot_start));
    const patientPrescriptions = prescriptions.filter((rx) => rx.patient_id === patientId);
    const latest = visitsInOrder[visitsInOrder.length - 1];
    const profile = visitsInOrder.find((row) => row.profiles)?.profiles ?? null;

    const visits: PatientVisit[] = visitsInOrder.map((row) => {
      const rx = patientPrescriptions.find((p) => p.consultation_id === row.id);
      return {
        id: row.id,
        date: row.slot_start,
        status: row.status,
        chiefComplaint: row.chief_complaint,
        diagnosis: rx?.diagnosis ?? null,
        notes: rx?.clinical_notes ?? null,
      };
    });

    const prescriptionList: PatientPrescription[] = patientPrescriptions.map((rx) => ({
      id: rx.id,
      visitId: rx.consultation_id,
      signedAt: rx.created_at,
      diagnosis: rx.diagnosis,
      followupDays: rx.followup_days,
      medicines: rx.prescription_medicines.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        durationDays: m.duration_days,
        instructions: m.instructions,
      })),
    }));

    return {
      id: patientId,
      name: profile?.full_name ?? "Unknown patient",
      age: null,
      sex: null,
      bloodGroup: null,
      phone: profile?.phone ?? null,
      emergencyContact: null,
      conditions: [...new Set(patientPrescriptions.map((rx) => rx.diagnosis))],
      allergies: [],
      drugAlerts: [],
      latestIntake: latest.chief_complaint
        ? { chiefComplaint: latest.chief_complaint, symptomsSince: null, medicalHistory: [], vitals: null }
        : null,
      visits,
      prescriptions: prescriptionList,
      labReports: [],
      dataSource: "live",
    };
  });
};

// Patients who have consulted with the logged-in doctor. Falls back to the mock records
// when the query fails or finds no one.
export const useDoctorPatients = () => {
  const { doctor } = useDoctor();

  return useQuery<PatientRecord[], Error>({
    queryKey: patientsKey(doctor.id),
    queryFn: () =>
      withFallback(
        async () => {
          const [consultationRes, prescriptionRes] = await Promise.all([
            supabase
              .from("consultations")
              .select("id, patient_id, slot_start, status, chief_complaint, profiles!consultations_patient_id_fkey(full_name, phone)")
              .eq("doctor_id", doctor.id)
              .neq("status", "cancelled")
              .order("slot_start", { ascending: true }),
            supabase
              .from("prescriptions")
              .select(
                "id, consultation_id, patient_id, diagnosis, clinical_notes, followup_days, created_at, prescription_medicines(name, dosage, frequency, duration_days, instructions)",
              )
              .eq("doctor_id", doctor.id),
          ]);
          if (consultationRes.error) throw new Error(consultationRes.error.message);
          if (prescriptionRes.error) throw new Error(prescriptionRes.error.message);
          return composeLivePatients(
            (consultationRes.data ?? []) as ConsultationRow[],
            (prescriptionRes.data ?? []) as PrescriptionRow[],
          );
        },
        FALLBACK_PATIENTS,
        "patients",
      ),
  });
};
