import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { markConsultationStarted } from "../lib/startedStore";
import { useDoctor } from "../context/DoctorContext";
import { CONSULTATION_QUEUE_KEY } from "./useConsultationQueue";
import type { QueueConsultation } from "../types/queue";

const LIVE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Moves a scheduled consultation to in_progress. The update only applies while it is still scheduled,
// so a second click or a stale queue cannot start the same consultation twice.
export const useStartConsultation = () => {
  const { doctor } = useDoctor();
  const queryClient = useQueryClient();

  return useMutation<void, Error, QueueConsultation>({
    mutationFn: async (consultation) => {
      if (!LIVE_ID.test(consultation.id)) {
        markConsultationStarted(consultation.id);
        return;
      }
      const { data, error } = await supabase
        .from("consultations")
        .update({ status: "in_progress" })
        .eq("id", consultation.id)
        .eq("status", "scheduled")
        .select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) {
        throw new Error("This consultation has already changed status. The queue has been refreshed.");
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...CONSULTATION_QUEUE_KEY, doctor.id] });
    },
  });
};
