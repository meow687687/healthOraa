import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InsertTables,
  NutritionProgram,
  UpdateTables,
} from "@healthoraa/types";
import { supabase } from "../lib/supabase";

export const programKeys = {
  all: ["programs"] as const,
  list: () => [...programKeys.all, "list"] as const,
};

export const usePrograms = () => {
  return useQuery<NutritionProgram[], Error>({
    queryKey: programKeys.list(),
    queryFn: async (): Promise<NutritionProgram[]> => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
};

export const useCreateProgram = () => {
  const queryClient = useQueryClient();

  return useMutation<NutritionProgram, Error, InsertTables<"programs">>({
    mutationFn: async (input: InsertTables<"programs">): Promise<NutritionProgram> => {
      const { data, error } = await supabase
        .from("programs")
        .insert(input)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programKeys.all }),
  });
};

export const useUpdateProgram = () => {
  const queryClient = useQueryClient();

  return useMutation<
    NutritionProgram,
    Error,
    { id: string; changes: UpdateTables<"programs"> }
  >({
    mutationFn: async ({ id, changes }): Promise<NutritionProgram> => {
      const { data, error } = await supabase
        .from("programs")
        .update(changes)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programKeys.all }),
  });
};

export const useDeleteProgram = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("programs").delete().eq("id", id);
      if (error) {
        if (error.code === "23503") {
          throw new Error(
            "This program has enrolment history and cannot be deleted. Deactivate it to keep customer records intact.",
          );
        }
        throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programKeys.all }),
  });
};

export const useToggleProgramActive = () => {
  const queryClient = useQueryClient();

  return useMutation<
    NutritionProgram,
    Error,
    { id: string; isActive: boolean }
  >({
    mutationFn: async ({ id, isActive }): Promise<NutritionProgram> => {
      const update: UpdateTables<"programs"> = { is_active: isActive };
      const { data, error } = await supabase
        .from("programs")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: programKeys.all }),
  });
};
