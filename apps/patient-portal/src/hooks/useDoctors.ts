import { useQuery } from "@tanstack/react-query";
import { withSingleFallback } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import { FALLBACK_DOCTORS } from "../lib/consultationFallback";
import type { DoctorOption } from "../types/consultations";

export const doctorsKey = ["consultations", "doctors"] as const;

// Columns returned by get_verified_practitioners. Contact details are not part of this list.
interface PractitionerRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
  qualification: string;
  consultation_fee_inr: number | string;
  slot_duration_minutes: number;
}

// Verified, active practitioners, through the restricted listing function. Falls back to the demo list
// only when the read fails.
export const useDoctors = () =>
  useQuery<DoctorOption[], Error>({
    queryKey: doctorsKey,
    queryFn: () =>
      withSingleFallback(
        async () => {
          const { data, error } = await supabase.rpc("get_verified_practitioners");
          if (error) throw new Error(error.message);
          return ((data ?? []) as PractitionerRow[]).map((row) => ({
            id: row.id,
            displayName: row.full_name || "Practitioner",
            qualification: row.qualification,
            feeInr: Number(row.consultation_fee_inr),
            slotDurationMinutes: row.slot_duration_minutes,
            avatarUrl: row.avatar_url,
            dataSource: "live" as const,
          }));
        },
        FALLBACK_DOCTORS,
        "doctors",
      ),
  });
