import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { withFallback } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import { useDoctor } from "../context/DoctorContext";
import { FALLBACK_RULES, UPCOMING_DAYS, buildFallbackSlots, generateSlots, validateSnapshot } from "../lib/scheduleGenerator";
import { readScheduleStore, writeScheduleStore } from "../lib/scheduleStore";
import type { ConsultationSlot, ScheduleBase, ScheduleSnapshot, ScheduleView, WindowDraft } from "../types/schedule";

export const scheduleKey = (practitionerId: string) => ["schedule", practitionerId] as const;

// React Query keeps the old `select` result when a refetch returns identical data. Publishing a
// new reference makes the view recompute from the local store right away.
const touchSchedule = (queryClient: QueryClient, practitionerId: string): void => {
  queryClient.setQueryData<ScheduleBase>(scheduleKey(practitionerId), (base) => (base ? { ...base } : base));
  void queryClient.invalidateQueries({ queryKey: scheduleKey(practitionerId) });
};

// Times come back from Postgres as HH:MM:SS. The UI and validation use HH:MM.
const toHHMM = (time: string): string => time.slice(0, 5);

const startOfToday = (): Date => {
  const day = new Date();
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
};

const loadBase = async (practitionerId: string, durationMinutes: number): Promise<ScheduleBase> => {
  const rules = await withFallback<WindowDraft>(
    async () => {
      const { data, error } = await supabase
        .from("practitioner_availability_rules")
        .select("id, day_of_week, start_time, end_time, is_active")
        .eq("practitioner_id", practitionerId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        day_of_week: row.day_of_week,
        start_time: toHHMM(row.start_time),
        end_time: toHHMM(row.end_time),
        is_active: row.is_active,
      }));
    },
    FALLBACK_RULES,
    "availability rules",
  );

  const from = startOfToday();
  const to = new Date(from.getTime() + UPCOMING_DAYS * 86_400_000);
  const slots = await withFallback<ConsultationSlot>(
    async () => {
      const { data, error } = await supabase
        .from("consultation_slots")
        .select("id, start_time, end_time, is_booked")
        .eq("practitioner_id", practitionerId)
        .gte("start_time", from.toISOString())
        .lt("start_time", to.toISOString())
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        slotStart: row.start_time,
        slotEnd: row.end_time,
        status: row.is_booked ? "booked" : "open",
      }));
    },
    buildFallbackSlots(),
    "consultation slots",
  );

  return { rules, durationMinutes, slots };
};

// Applies local draft and publish state over the base query result.
const composeView = (base: ScheduleBase): ScheduleView => {
  const store = readScheduleStore();
  const baseSnapshot: ScheduleSnapshot = { rules: base.rules, durationMinutes: base.durationMinutes };
  return {
    draft: store.draft ?? baseSnapshot,
    published: store.published ?? baseSnapshot,
    publishedSlots: store.publishedSlots ?? base.slots,
    publishedAt: store.publishedAt,
  };
};

export const useDoctorSchedule = () => {
  const { doctor } = useDoctor();
  return useQuery<ScheduleBase, Error, ScheduleView>({
    queryKey: scheduleKey(doctor.id),
    queryFn: () => loadBase(doctor.id, doctor.slotDurationMinutes),
    select: composeView,
    // Disabled so each write produces a new reference. Structural sharing would keep the old view.
    structuralSharing: false,
  });
};

// Saves the working copy as the draft. Patients still see the last published slots.
export const useSaveScheduleDraft = () => {
  const { doctor } = useDoctor();
  const queryClient = useQueryClient();
  return useMutation<void, Error, ScheduleSnapshot>({
    mutationFn: async (snapshot) => {
      validateSnapshot(snapshot);
      writeScheduleStore({ draft: snapshot });
    },
    onSuccess: () => touchSchedule(queryClient, doctor.id),
  });
};

export interface PublishInput {
  snapshot: ScheduleSnapshot;
  previousSlots: ConsultationSlot[];
}

// Generates the upcoming week's slots and makes them patient-visible. Slots that were already
// booked stay booked when the same slot is generated again.
export const usePublishSlots = () => {
  const { doctor } = useDoctor();
  const queryClient = useQueryClient();
  return useMutation<number, Error, PublishInput>({
    mutationFn: async ({ snapshot, previousSlots }) => {
      validateSnapshot(snapshot);
      const bookedIds = new Set(previousSlots.filter((slot) => slot.status === "booked").map((slot) => slot.id));
      const slots = generateSlots(snapshot.rules, snapshot.durationMinutes, new Date(), UPCOMING_DAYS).map((slot) =>
        bookedIds.has(slot.id) ? { ...slot, status: "booked" as const } : slot,
      );
      writeScheduleStore({
        draft: snapshot,
        published: snapshot,
        publishedSlots: slots,
        publishedAt: new Date().toISOString(),
      });
      return slots.length;
    },
    onSuccess: () => touchSchedule(queryClient, doctor.id),
  });
};
