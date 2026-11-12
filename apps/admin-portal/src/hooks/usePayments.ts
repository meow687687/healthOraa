import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaymentTransaction, Profile } from "@healthoraa/types";
import { watchTables } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";

type CustomerRef = { profiles: Pick<Profile, "full_name"> | null } | null;

export type PaymentRow = PaymentTransaction & {
  orders: CustomerRef & { id: string };
  consultations: CustomerRef & { id: string };
};

export type PaymentWithCustomer = PaymentTransaction & {
  customer_name: string | null;
  linked_order_id: string | null;
  linked_consultation_id: string | null;
};

export const paymentKeys = {
  all: ["payments"] as const,
  list: () => [...paymentKeys.all, "list"] as const,
};

const toPaymentWithCustomer = (row: PaymentRow): PaymentWithCustomer => {
  const { orders, consultations, ...transaction } = row;
  return {
    ...transaction,
    customer_name:
      orders?.profiles?.full_name ?? consultations?.profiles?.full_name ?? null,
    linked_order_id: orders?.id ?? null,
    linked_consultation_id: consultations?.id ?? null,
  };
};

export const usePayments = () => {
  const queryClient = useQueryClient();

  // Realtime: new and updated payment transactions refresh the audit feed without a reload.
  useEffect(
    () =>
      watchTables(supabase, "admin-payments", [{ table: "payment_transactions", events: ["INSERT", "UPDATE"] }], () => {
        void queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      }),
    [queryClient],
  );

  return useQuery<PaymentWithCustomer[], Error>({
    queryKey: paymentKeys.list(),
    queryFn: async (): Promise<PaymentWithCustomer[]> => {
      const { data, error } = await supabase
        .from("payment_transactions")
        .select(
          `*,
          orders:orders!payment_transactions_order_id_fkey(id, profiles!orders_customer_id_fkey(full_name)),
          consultations:consultations!payment_transactions_consultation_id_fkey(id, profiles!consultations_patient_id_fkey(full_name))`,
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return ((data ?? []) as PaymentRow[]).map(toPaymentWithCustomer);
    },
  });
};
