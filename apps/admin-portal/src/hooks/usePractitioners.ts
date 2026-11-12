import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PractitionerDetail,
  Profile,
  UpdateTables,
} from "@healthoraa/types";
import { supabase } from "../lib/supabase";

export type PractitionerWithProfile = PractitionerDetail & {
  profiles: Pick<Profile, "full_name" | "phone" | "role">;
};

export const practitionerKeys = {
  all: ["practitioners"] as const,
  list: () => [...practitionerKeys.all, "list"] as const,
};

export const usePractitioners = () => {
  return useQuery<PractitionerWithProfile[], Error>({
    queryKey: practitionerKeys.list(),
    queryFn: async (): Promise<PractitionerWithProfile[]> => {
      const { data, error } = await supabase
        .from("practitioner_details")
        .select(
          "*, profiles!practitioner_details_id_fkey(full_name, phone, role)",
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as PractitionerWithProfile[];
    },
  });
};

export type ReviewPractitionerInput =
  | { id: string; decision: "verified" }
  | { id: string; decision: "rejected"; reason: string };

export const useReviewPractitioner = () => {
  const queryClient = useQueryClient();

  return useMutation<PractitionerDetail, Error, ReviewPractitionerInput>({
    mutationFn: async (input): Promise<PractitionerDetail> => {
      const update: UpdateTables<"practitioner_details"> =
        input.decision === "verified"
          ? { verification_status: "verified", rejection_reason: null }
          : {
              verification_status: "rejected",
              rejection_reason: input.reason,
              is_active: false,
            };

      const { data, error } = await supabase
        .from("practitioner_details")
        .update(update)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: practitionerKeys.all }),
  });
};

export const useTogglePractitionerActive = () => {
  const queryClient = useQueryClient();

  return useMutation<
    PractitionerDetail,
    Error,
    { id: string; isActive: boolean }
  >({
    mutationFn: async ({ id, isActive }): Promise<PractitionerDetail> => {
      const update: UpdateTables<"practitioner_details"> = {
        is_active: isActive,
      };
      const { data, error } = await supabase
        .from("practitioner_details")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: practitionerKeys.all }),
  });
};
