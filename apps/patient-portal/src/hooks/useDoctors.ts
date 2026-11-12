import { useQuery } from "@tanstack/react-query";
import { withSingleFallback } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import { FALLBACK_DOCTORS } from "../lib/consultationFallback";
import type { DoctorOption } from "../types/consultations";

export const doctorsKey = ["consultations", "doctors"] as const;

interface DoctorRow {
  id: string;
  qualification: string;
  registration_number: string;
  consultation_fee_inr: number;
  slot_duration_minutes: number;
  avatar_url: string | null;
  profiles: { full_name: string } | null;
}

// Verified, active practitioners. Falls back to the demo list only when the read fails.
export const useDoctors = () =>
  useQuery<DoctorOption[], Error>({
    queryKey: doctorsKey,
    queryFn: () =>
      withSingleFallback(
        async () => {
          const { data, error } = await supabase
            .from("practitioner_details")
            .select("id, qualification, registration_number, consultation_fee_inr, slot_duration_minutes, avatar_url, profiles(full_name)")
            .eq("verification_status", "verified")
            .eq("is_active", true);
          if (error) throw new Error(error.message);
          return ((data ?? []) as DoctorRow[]).map((row) => ({
            id: row.id,
            displayName: row.profiles?.full_name ?? "Practitioner",
            qualification: row.qualification,
            registrationNumber: row.registration_number,
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
