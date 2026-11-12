import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withSingleFallback } from "@healthoraa/ui";
import { updatePractitionerProfileSchema } from "@healthoraa/validation";
import type { UpdatePractitionerProfileInput } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";
import { useDoctor } from "../context/DoctorContext";
import { FALLBACK_PRACTITIONER_PROFILE } from "../lib/profileFallback";
import type { PractitionerProfile, VerificationStatus } from "../types/profile";

export const practitionerKey = (doctorId: string) => ["practitioner", doctorId] as const;

// Profile fields come from practitioner_details; the name and phone are embedded from profiles.
const PRACTITIONER_SELECT =
  "id, qualification, registration_number, bio, consultation_fee_inr, slot_duration_minutes, languages_spoken, years_of_experience, avatar_url, verification_status, profiles(full_name, phone)";

interface PractitionerRow {
  id: string;
  qualification: string;
  registration_number: string;
  bio: string | null;
  consultation_fee_inr: number;
  slot_duration_minutes: number;
  languages_spoken: string[] | null;
  years_of_experience: number | null;
  avatar_url: string | null;
  verification_status: VerificationStatus;
  profiles: { full_name: string; phone: string | null } | null;
}

export const toPractitionerProfile = (row: PractitionerRow): PractitionerProfile => ({
  id: row.id,
  displayName: row.profiles?.full_name ?? "Unnamed practitioner",
  avatarUrl: row.avatar_url,
  email: null,
  phone: row.profiles?.phone ?? null,
  qualification: row.qualification,
  registrationNumber: row.registration_number,
  verificationStatus: row.verification_status,
  bio: row.bio ?? "",
  consultationFeeInr: Number(row.consultation_fee_inr),
  slotDurationMinutes: row.slot_duration_minutes,
  languagesSpoken: row.languages_spoken ?? [],
  yearsOfExperience: row.years_of_experience,
  dataSource: "live",
});

// The logged-in doctor's profile. Falls back to the seeded profile when the read fails or the row is missing.
export const usePractitionerProfile = () => {
  const { doctor } = useDoctor();

  return useQuery<PractitionerProfile, Error>({
    queryKey: practitionerKey(doctor.id),
    queryFn: () =>
      withSingleFallback(
        async () => {
          const { data, error } = await supabase
            .from("practitioner_details")
            .select(PRACTITIONER_SELECT)
            .eq("id", doctor.id)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) throw new Error("No practitioner profile found for this doctor.");
          return toPractitionerProfile(data as PractitionerRow);
        },
        FALLBACK_PRACTITIONER_PROFILE,
        "practitioner profile",
      ),
  });
};

// Validates the settings, then writes them. The anon client cannot call the update_practitioner_profile
// RPC, so the write goes to the row directly, which the development RLS policy allows.
export const useUpdatePractitionerProfile = () => {
  const { doctor } = useDoctor();
  const queryClient = useQueryClient();

  return useMutation<UpdatePractitionerProfileInput, Error, UpdatePractitionerProfileInput>({
    mutationFn: async (input) => {
      const parsed = updatePractitionerProfileSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check the highlighted fields.");
      }
      const values = parsed.data;

      const { data, error } = await supabase
        .from("practitioner_details")
        .update({
          qualification: values.qualification,
          consultation_fee_inr: values.consultation_fee_inr,
          slot_duration_minutes: values.slot_duration_minutes,
          bio: values.bio ? values.bio : null,
          languages_spoken: values.languages_spoken,
          years_of_experience: values.years_of_experience,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doctor.id)
        .select("id");
      if (error) throw new Error(error.message);
      // An update that matches no row succeeds silently, so check that something changed.
      if (!data || data.length === 0) throw new Error("No practitioner profile was updated. Nothing was saved.");

      return values;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: practitionerKey(doctor.id) }),
  });
};
