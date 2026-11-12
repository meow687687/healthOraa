import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ComplianceRequest, Profile, UpdateTables } from "@healthoraa/types";
import { supabase } from "../lib/supabase";
import { FALLBACK_COMPLIANCE_REQUESTS, withFallback } from "../lib/fallbackData";

export type ComplianceRequestWithUser = ComplianceRequest & {
  profiles: Pick<Profile, "full_name" | "role"> | null;
};

export const complianceKeys = {
  all: ["compliance"] as const,
  list: () => [...complianceKeys.all, "list"] as const,
};

export const useComplianceRequests = () => {
  return useQuery<ComplianceRequestWithUser[], Error>({
    queryKey: complianceKeys.list(),
    queryFn: (): Promise<ComplianceRequestWithUser[]> =>
      withFallback(
        async () => {
          const { data, error } = await supabase
            .from("compliance_requests")
            .select("*, profiles!compliance_requests_user_id_fkey(full_name, role)")
            .order("created_at", { ascending: false });
          if (error) throw new Error(error.message);
          return (data ?? []) as ComplianceRequestWithUser[];
        },
        FALLBACK_COMPLIANCE_REQUESTS,
        "compliance requests",
      ),
  });
};

export type ResolveComplianceInput =
  | { request: ComplianceRequestWithUser; action: "erase" }
  | { request: ComplianceRequestWithUser; action: "complete" };

export const useResolveComplianceRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<ComplianceRequest, Error, ResolveComplianceInput>({
    mutationFn: async ({ request, action }): Promise<ComplianceRequest> => {
      // Erasure runs in a single database transaction so the profile and the request
      // are always updated together.
      if (action === "erase") {
        const { data, error } = await supabase
          .rpc("resolve_erasure_request", { p_request_id: request.id })
          .single();
        if (error) throw new Error(error.message);
        return data as ComplianceRequest;
      }

      const update: UpdateTables<"compliance_requests"> = {
        status: "completed",
        notes: "Data export packet generated and delivered to the admin.",
        resolved_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("compliance_requests")
        .update(update)
        .eq("id", request.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: complianceKeys.all }),
  });
};
