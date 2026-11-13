import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface ActivityEvent {
  id: string;
  kind: "order" | "payment" | "registration";
  title: string;
  detail: string;
  at: string;
}

// The latest orders, payments and sign-ups, merged and sorted by time.
export const useRecentActivity = () =>
  useQuery<ActivityEvent[], Error>({
    queryKey: ["admin-activity"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [orders, payments, people] = await Promise.all([
        supabase
          .from("orders")
          .select("id, total_amount_inr, status, created_at, profiles!orders_customer_id_fkey(full_name)")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("payment_transactions")
          .select("id, amount_inr, status, created_at, gateway_payment_id")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(10),
      ]);
      const failure = orders.error ?? payments.error ?? people.error;
      if (failure) throw new Error(failure.message);

      const events: ActivityEvent[] = [
        ...(orders.data ?? []).map((row) => ({
          id: `order-${row.id}`,
          kind: "order" as const,
          title: `Order from ${row.profiles?.full_name ?? "a customer"}`,
          detail: `${row.status} · ${Number(row.total_amount_inr).toFixed(2)} INR`,
          at: row.created_at,
        })),
        ...(payments.data ?? []).map((row) => ({
          id: `payment-${row.id}`,
          kind: "payment" as const,
          title: `Payment ${row.status}`,
          detail: row.gateway_payment_id ?? "No gateway reference",
          at: row.created_at,
        })),
        ...(people.data ?? []).map((row) => ({
          id: `profile-${row.id}`,
          kind: "registration" as const,
          title: `${row.full_name} joined`,
          detail: row.role,
          at: row.created_at,
        })),
      ];
      return events.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 10);
    },
  });
