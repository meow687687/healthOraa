import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InsertTables,
  Product,
  UpdateTables,
} from "@healthoraa/types";
import { supabase } from "../lib/supabase";
import { FALLBACK_PRODUCTS, withFallback } from "../lib/fallbackData";

export const productKeys = {
  all: ["products"] as const,
  list: () => [...productKeys.all, "list"] as const,
};

export const useProducts = () => {
  return useQuery<Product[], Error>({
    queryKey: productKeys.list(),
    queryFn: (): Promise<Product[]> =>
      withFallback(
        async () => {
          const { data, error } = await supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) throw new Error(error.message);
          return data ?? [];
        },
        FALLBACK_PRODUCTS,
        "products",
      ),
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<Product, Error, InsertTables<"products">>({
    mutationFn: async (input: InsertTables<"products">): Promise<Product> => {
      const { data, error } = await supabase
        .from("products")
        .insert(input)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
};

export const useToggleProductActive = () => {
  const queryClient = useQueryClient();

  return useMutation<Product, Error, { id: string; isActive: boolean }>({
    mutationFn: async ({ id, isActive }): Promise<Product> => {
      const update: UpdateTables<"products"> = { is_active: isActive };
      const { data, error } = await supabase
        .from("products")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
};
