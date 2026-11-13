import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { watchTables, withFallback } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import { FALLBACK_ANCHOR, buildFallbackQueue } from "../lib/fallbackData";
import { followupWindowFrom } from "../lib/followupWindow";
import { signedConsultationIds } from "../lib/prescriptionStore";
import { startedConsultationIds } from "../lib/startedStore";
import { useDoctor } from "../context/DoctorContext";
import type { ConsultationStatus, QueueConsultation } from "../types/queue";

export const CONSULTATION_QUEUE_KEY = ["consultations", "queue"] as const;

const QUEUE_STATUSES: ConsultationStatus[] = ["scheduled", "in_progress", "completed"];

interface QueueRow {
  id: string;
  patient_id: string;
  slot_start: string;
  slot_end: string;
  status: ConsultationStatus;
  followup_expires_at: string | null;
  chief_complaint: string | null;
  profiles: { full_name: string } | null;
}

interface IntakeRow {
  consultation_id: string;
  age: number | null;
  gender: string | null;
  chief_complaint: string | null;
  symptoms_duration: string | null;
  known_allergies: string[] | null;
  current_medications: string[] | null;
}

const startOfToday = (): string => {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
};

const toQueueItem = (row: QueueRow, intake: IntakeRow | undefined): QueueConsultation => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.profiles?.full_name ?? "Unknown patient",
  age: intake?.age ?? null,
  gender: intake?.gender ?? null,
  chiefComplaint: intake?.chief_complaint ?? row.chief_complaint,
  slotStart: row.slot_start,
  slotEnd: row.slot_end,
  status: row.status,
  followupExpiresAt: row.followup_expires_at,
  symptomsDuration: intake?.symptoms_duration ?? null,
  allergies: intake?.known_allergies ?? [],
  medications: intake?.current_medications ?? [],
});

// One extra request for the whole queue. If it fails, the queue still loads without intake detail.
const fetchIntakes = async (ids: string[]): Promise<Map<string, IntakeRow>> => {
  const byId = new Map<string, IntakeRow>();
  if (ids.length === 0) return byId;
  const { data, error } = await supabase
    .from("patient_intake_forms")
    .select("consultation_id, age, gender, chief_complaint, symptoms_duration, known_allergies, current_medications")
    .in("consultation_id", ids);
  if (error) {
    console.warn("Intake details could not load", error.message);
    return byId;
  }
  for (const row of (data ?? []) as IntakeRow[]) byId.set(row.consultation_id, row);
  return byId;
};

// Applied after every fetch. The fallback queue is rebuilt on each fetch, so a signed
// prescription would otherwise revert to in-progress on the next refetch.
// Demo consultations started on this device show as in progress until the queue is reloaded.
const withStartedStatus = (queue: QueueConsultation[]): QueueConsultation[] => {
  const started = startedConsultationIds();
  return queue.map((c) => (started.has(c.id) && c.status === "scheduled" ? { ...c, status: "in_progress" } : c));
};

const withSignedStatus = (queue: QueueConsultation[]): QueueConsultation[] => {
  const signed = signedConsultationIds();
  return queue.map((c) =>
    signed.has(c.id) && c.status !== "cancelled"
      ? { ...c, status: "completed", followupExpiresAt: c.followupExpiresAt ?? followupWindowFrom(c.slotEnd) }
      : c,
  );
};

// Today's consultations for the logged-in doctor, falling back to mock data
// when Supabase is unreachable or returns no rows.
export const useConsultationQueue = () => {
  const { doctor } = useDoctor();
  const queryClient = useQueryClient();

  // Realtime: a new booking, payment or status change refetches the queue at once.
  // The queue needs patient names, which the change payload does not carry, so this invalidates.
  useEffect(
    () =>
      watchTables(supabase, `doctor-consultations:${doctor.id}`, [
        { table: "consultations", events: ["INSERT", "UPDATE"], filter: `doctor_id=eq.${doctor.id}` },
      ], () => {
        void queryClient.invalidateQueries({ queryKey: [...CONSULTATION_QUEUE_KEY, doctor.id] });
      }),
    [doctor.id, queryClient],
  );

  return useQuery<QueueConsultation[], Error>({
    queryKey: [...CONSULTATION_QUEUE_KEY, doctor.id],
    queryFn: () =>
      withFallback(
        async () => {
          const { data, error } = await supabase
            .from("consultations")
            .select("id, patient_id, slot_start, slot_end, status, followup_expires_at, chief_complaint, profiles!consultations_patient_id_fkey(full_name)")
            .eq("doctor_id", doctor.id)
            .in("status", QUEUE_STATUSES)
            .gte("slot_start", startOfToday())
            .order("slot_start", { ascending: true });
          if (error) throw new Error(error.message);
          const rows = (data ?? []) as QueueRow[];
          const intakes = await fetchIntakes(rows.map((row) => row.id));
          return rows.map((row) => toQueueItem(row, intakes.get(row.id)));
        },
        buildFallbackQueue(FALLBACK_ANCHOR),
        "consultation queue",
      ),
    select: (queue) => withStartedStatus(withSignedStatus(queue)),
    refetchInterval: 60_000,
  });
};
