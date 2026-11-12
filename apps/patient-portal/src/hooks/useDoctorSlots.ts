import { useQuery } from "@tanstack/react-query";
import { withSingleFallback } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import { buildFallbackSlots } from "../lib/slotPlanner";
import { deviceBookedSlotIds } from "../lib/deviceBookingStore";
import type { SlotOption } from "../types/consultations";

export const doctorSlotsKey = (doctorId: string) => ["consultations", "slots", doctorId] as const;

// Open future slots for the next eight days. An empty result is a real "fully booked" state, so only
// a failed read falls back to demo slots. Slots this browser has already booked are hidden.
export const useDoctorSlots = (doctorId: string) =>
  useQuery<SlotOption[], Error>({
    queryKey: doctorSlotsKey(doctorId),
    queryFn: () =>
      withSingleFallback(
        async () => {
          const now = new Date();
          const horizon = new Date(now.getTime() + 8 * 86_400_000);
          const { data, error } = await supabase
            .from("consultation_slots")
            .select("id, practitioner_id, start_time, end_time")
            .eq("practitioner_id", doctorId)
            .eq("is_booked", false)
            .gt("start_time", now.toISOString())
            .lt("start_time", horizon.toISOString())
            .order("start_time", { ascending: true });
          if (error) throw new Error(error.message);

          const taken = deviceBookedSlotIds();
          return (data ?? [])
            .filter((row) => !taken.has(row.id))
            .map((row) => ({
              id: row.id,
              doctorId: row.practitioner_id,
              startsAt: row.start_time,
              endsAt: row.end_time,
              source: "live" as const,
            }));
        },
        buildFallbackSlots(doctorId, new Date()),
        "doctor slots",
      ),
  });
