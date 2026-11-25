import { useQuery } from "@tanstack/react-query";
import type { NutritionProgram } from "@healthoraa/types";
import { supabase } from "../lib/supabase";

export type ProgramCatalogItem = Pick<
  NutritionProgram,
  | "id"
  | "title"
  | "category"
  | "description"
  | "duration_days"
  | "intro_video_url"
>;

export const programCatalogKey = ["programs", "catalog", "active"] as const;

export const useProgramCatalog = () =>
  useQuery<ProgramCatalogItem[], Error>({
    queryKey: programCatalogKey,
    queryFn: async (): Promise<ProgramCatalogItem[]> => {
      const { data, error } = await supabase
        .from("programs")
        .select(
          "id, title, category, description, duration_days, intro_video_url",
        )
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
