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
