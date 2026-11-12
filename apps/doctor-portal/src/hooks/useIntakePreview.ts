import { useQuery } from "@tanstack/react-query";
import { intakeFor, type IntakePreview } from "../lib/intakeFallback";

// Intake data comes from the client mock until an intake table exists.
export const useIntakePreview = (consultationId: string) =>
  useQuery<IntakePreview, Error>({
    queryKey: ["consultations", "intake", consultationId],
    queryFn: async () => intakeFor(consultationId),
    staleTime: Infinity,
  });
