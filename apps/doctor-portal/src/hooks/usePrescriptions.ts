import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPrescriptionSchema } from "@healthoraa/validation";
import type { CreatePrescriptionInput } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";
import { useDoctor } from "../context/DoctorContext";
import { isMockConsultation } from "../lib/chatFallback";
import { saveStoredPrescription, type StoredPrescription } from "../lib/prescriptionStore";
import { addDays } from "../lib/prescriptionOptions";
import type { QueueConsultation } from "../types/queue";
import { CONSULTATION_QUEUE_KEY } from "./useConsultationQueue";

export interface SavePrescriptionInput {
  consultation: QueueConsultation;
  values: CreatePrescriptionInput;
}

// Signs a prescription. Live consultations go through issue_prescription, which writes the
// prescription and its medicines in one transaction and completes the consultation. Demo
// consultations have no database row, so they are kept on this device only.
export const useSavePrescription = () => {
  const queryClient = useQueryClient();
  const { doctor } = useDoctor();

  return useMutation<StoredPrescription, Error, SavePrescriptionInput>({
    mutationFn: async ({ consultation, values }) => {
      // Re-validate at the boundary: this mutation can be called from more than one place.
      const parsed = createPrescriptionSchema.parse(values);
      const signedAt = new Date();
      const record: StoredPrescription = {
        ...parsed,
        id: crypto.randomUUID(),
        consultationId: consultation.id,
        patientName: consultation.patientName,
        doctorId: doctor.id,
        signedAt: signedAt.toISOString(),
        followupUntil: addDays(signedAt, parsed.followup_days).toISOString(),
      };

      if (isMockConsultation(consultation.id)) {
        saveStoredPrescription(record);
        return record;
      }

      const { data, error } = await supabase.rpc("issue_prescription", {
        p_consultation_id: consultation.id,
        p_diagnosis: parsed.diagnosis,
        p_clinical_notes: parsed.clinical_notes ?? "",
        p_followup_days: parsed.followup_days,
        p_medicines: parsed.medicines.map((medicine) => ({
          name: medicine.name,
          dosage: medicine.dosage,
          frequency: medicine.frequency,
          duration_days: medicine.duration_days,
          instructions: medicine.instructions ?? "",
        })),
      });
      if (error) throw new Error(`The prescription was not signed: ${error.message}`);
      return { ...record, id: data };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONSULTATION_QUEUE_KEY }),
  });
};
