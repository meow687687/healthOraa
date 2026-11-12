import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { watchTables, withFallback } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import { FALLBACK_ANCHOR, buildFallbackQueue } from "../lib/fallbackData";
import { followupWindowFrom } from "../lib/followupWindow";
import { signedConsultationIds } from "../lib/prescriptionStore";
import { useDoctor } from "../context/DoctorContext";
import type { ConsultationStatus, QueueConsultation } from "../types/queue";

export const CONSULTATION_QUEUE_KEY = ["consultations", "queue"] as const;

const QUEUE_STATUSES: ConsultationStatus[] = ["scheduled", "in_progress", "completed"];

interface QueueRow {
  id: string;
  slot_start: string;
  slot_end: string;
  status: ConsultationStatus;
  followup_expires_at: string | null;
  profiles: { full_name: string } | null;
}

const startOfToday = (): string => {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
};

const toQueueItem = (row: QueueRow): QueueConsultation => ({
  id: row.id,
  patientName: row.profiles?.full_name ?? "Unknown patient",
  age: null,
  gender: null,
  chiefComplaint: null,
  slotStart: row.slot_start,
  slotEnd: row.slot_end,
  status: row.status,
  followupExpiresAt: row.followup_expires_at,
});

// Applied after every fetch. The fallback queue is rebuilt on each fetch, so a signed
// prescription would otherwise revert to in-progress on the next refetch.
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
            .select("id, slot_start, slot_end, status, followup_expires_at, profiles!consultations_patient_id_fkey(full_name)")
            .eq("doctor_id", doctor.id)
            .in("status", QUEUE_STATUSES)
            .gte("slot_start", startOfToday())
            .order("slot_start", { ascending: true });
          if (error) throw new Error(error.message);
          return ((data ?? []) as QueueRow[]).map(toQueueItem);
        },
        buildFallbackQueue(FALLBACK_ANCHOR),
        "consultation queue",
      ),
    select: withSignedStatus,
    refetchInterval: 60_000,
  });
};
