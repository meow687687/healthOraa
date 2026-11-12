import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPrescriptionSchema } from "@healthoraa/validation";
import type { CreatePrescriptionInput } from "@healthoraa/validation";
import { useDoctor } from "../context/DoctorContext";
import { saveStoredPrescription, type StoredPrescription } from "../lib/prescriptionStore";
import { addDays } from "../lib/prescriptionOptions";
import type { QueueConsultation } from "../types/queue";
import { CONSULTATION_QUEUE_KEY } from "./useConsultationQueue";

export interface SavePrescriptionInput {
  consultation: QueueConsultation;
  values: CreatePrescriptionInput;
}

// Signs a prescription and marks its consultation completed on the client.
// Nothing is sent to Supabase: there is no prescriptions table yet.
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
      saveStoredPrescription(record);
      return record;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONSULTATION_QUEUE_KEY }),
  });
};
