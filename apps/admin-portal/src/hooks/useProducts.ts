import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  InsertTables,
  Product,
  UpdateTables,
} from "@healthoraa/types";
import { supabase } from "../lib/supabase";

export const productKeys = {
  all: ["products"] as const,
  list: () => [...productKeys.all, "list"] as const,
};

export const useProducts = () => {
  return useQuery<Product[], Error>({
    queryKey: productKeys.list(),
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
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

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<
    Product,
    Error,
    { id: string; changes: UpdateTables<"products"> }
  >({
    mutationFn: async ({ id, changes }): Promise<Product> => {
      const { data, error } = await supabase
        .from("products")
        .update(changes)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) {
        if (error.code === "23503") {
          throw new Error(
            "This product is in a customer cart or order and cannot be deleted. Deactivate it to preserve customer records.",
          );
        }
        throw new Error(error.message);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
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
