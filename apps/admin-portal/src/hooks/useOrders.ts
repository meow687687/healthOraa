import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Order, OrderStatus, Profile, UpdateTables } from "@healthoraa/types";
import { updateOrderStatusSchema } from "@healthoraa/validation";
import { watchTables } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";

export type OrderWithCustomer = Order & {
  profiles: Pick<Profile, "full_name">;
};

export const orderKeys = {
  all: ["orders"] as const,
  list: () => [...orderKeys.all, "list"] as const,
};

export const useOrders = () => {
  const queryClient = useQueryClient();

  // Realtime: new and updated orders refresh the list without a page reload.
  useEffect(
    () =>
      watchTables(supabase, "admin-orders", [{ table: "orders", events: ["INSERT", "UPDATE"] }], () => {
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      }),
    [queryClient],
  );

  return useQuery<OrderWithCustomer[], Error>({
    queryKey: orderKeys.list(),
    queryFn: async (): Promise<OrderWithCustomer[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, profiles!orders_customer_id_fkey(full_name)",
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as OrderWithCustomer[];
    },
  });
};

export type UpdateOrderStatusArgs = {
  id: string;
  status: OrderStatus;
  trackingNumber?: string;
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation<Order, Error, UpdateOrderStatusArgs>({
    mutationFn: async ({ id, status, trackingNumber }): Promise<Order> => {
      const parsed = updateOrderStatusSchema.safeParse({
        status,
        tracking_number: trackingNumber,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid order update.");
      }

      const input: UpdateTables<"orders"> = {
        status: parsed.data.status,
        ...(parsed.data.tracking_number !== undefined && {
          tracking_number: parsed.data.tracking_number || null,
        }),
      };

      const { data, error } = await supabase
        .from("orders")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
  });
};
