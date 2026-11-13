import { useQuery } from "@tanstack/react-query";
import type { CreatePrescriptionInput } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";
import { isMockConsultation } from "../lib/chatFallback";

export const latestPrescriptionKey = (consultationId: string) => ["prescriptions", "latest", consultationId] as const;

// The most recent signed prescription for a live consultation, shaped as composer values.
// Resolves to null when none has been signed yet. Demo consultations are never queried.
export const useLatestPrescription = (consultationId: string) =>
  useQuery<CreatePrescriptionInput | null, Error>({
    queryKey: latestPrescriptionKey(consultationId),
    enabled: !isMockConsultation(consultationId),
    // Each open of the composer must read the saved version. A cached "no prescription yet" from an
    // earlier open would otherwise start the form blank, so the cache is dropped once unobserved.
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(
          "diagnosis, clinical_notes, followup_days, created_at, prescription_medicines(name, dosage, frequency, duration_days, instructions, created_at)",
        )
        .eq("consultation_id", consultationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        diagnosis: data.diagnosis,
        clinical_notes: data.clinical_notes ?? "",
        followup_days: data.followup_days,
        medicines: [...data.prescription_medicines]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((medicine) => ({
            name: medicine.name,
            dosage: medicine.dosage,
            frequency: medicine.frequency,
            duration_days: medicine.duration_days,
            instructions: medicine.instructions ?? "",
          })),
      };
    },
  });
