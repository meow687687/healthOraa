import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppBanner, InsertTables, UpdateTables } from "@healthoraa/types";
import { createBannerSchema } from "@healthoraa/validation";
import type { CreateBannerInput } from "@healthoraa/validation";
import { supabase } from "../lib/supabase";

export const bannerKeys = {
  all: ["banners"] as const,
  list: () => [...bannerKeys.all, "list"] as const,
};

export const useBanners = () => {
  return useQuery<AppBanner[], Error>({
    queryKey: bannerKeys.list(),
    queryFn: async (): Promise<AppBanner[]> => {
      const { data, error } = await supabase
        .from("app_banners")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
};

export const useCreateBanner = () => {
  const queryClient = useQueryClient();

  return useMutation<AppBanner, Error, CreateBannerInput>({
    mutationFn: async (input): Promise<AppBanner> => {
      const parsed = createBannerSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid banner.");
      }

      const payload: InsertTables<"app_banners"> = {
        title: parsed.data.title,
        image_url: parsed.data.image_url,
        target_type: parsed.data.target_type,
        target_id: parsed.data.target_id || null,
        display_order: parsed.data.display_order,
      };

      const { data, error } = await supabase
        .from("app_banners")
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bannerKeys.all }),
  });
};

export const useToggleBannerActive = () => {
  const queryClient = useQueryClient();

  return useMutation<AppBanner, Error, { id: string; isActive: boolean }>({
    mutationFn: async ({ id, isActive }): Promise<AppBanner> => {
      const update: UpdateTables<"app_banners"> = { is_active: isActive };
      const { data, error } = await supabase
        .from("app_banners")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bannerKeys.all }),
  });
};

export const useUpdateBannerOrder = () => {
  const queryClient = useQueryClient();

  return useMutation<AppBanner, Error, { id: string; displayOrder: number }>({
    mutationFn: async ({ id, displayOrder }): Promise<AppBanner> => {
      const update: UpdateTables<"app_banners"> = {
        display_order: displayOrder,
      };
      const { data, error } = await supabase
        .from("app_banners")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bannerKeys.all }),
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }): Promise<void> => {
      const { error } = await supabase
        .from("app_banners")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bannerKeys.all }),
  });
};
