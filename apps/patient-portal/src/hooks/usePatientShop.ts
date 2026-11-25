import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { ShopProduct } from "../types/shop";

export const shopProductsKey = ["shop", "products"] as const;

// The Phase 1 shop is a read-only catalogue. Pricing, stock and ordering require client approvals.
export const useShopProducts = (): UseQueryResult<ShopProduct[], Error> =>
  useQuery<ShopProduct[], Error>({
    queryKey: shopProductsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, category, description")
        .eq("is_active", true)
        .order("title", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        description: row.description ?? "Product information is pending approval.",
      }));
    },
  });
