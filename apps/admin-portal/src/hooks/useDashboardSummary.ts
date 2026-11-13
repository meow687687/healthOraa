import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface Pair {
  current: number;
  previous: number;
}

export interface DailyPoint {
  day: string;
  revenue_inr: number;
  orders: number;
  bookings: number;
  enrolments: number;
}

export interface DashboardSummary {
  generated_at: string;
  window_days: number;
  attention: {
    pending_verifications: number;
    failed_payments_24h: number;
    paid_unshipped: number;
    low_stock: number;
    open_compliance: number;
  };
  signals: {
    stale_payment_orders: number;
    bookings_awaiting_payment: number;
    active_enrolments: number;
  };
  kpis: {
    revenue_inr: Pair;
    orders: Pair;
    bookings: Pair;
    enrolments: Pair;
  };
  daily: DailyPoint[];
  revenue_previous_daily: { day: string; revenue_inr: number }[];
  orders_by_status: Record<string, number>;
  funnel: {
    slots_published: number;
    booked: number;
    paid: number;
    completed: number;
  };
  heatmap: { weekday: number; hour: number; count: number }[];
  top_products: { id: string; title: string; units: number; revenue_inr: number }[];
}

// The function's output is checked for its main sections before the screens use it.
export function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (typeof value !== "object" || value === null) return false;
  return "kpis" in value && "daily" in value && "attention" in value && "funnel" in value && "signals" in value;
}

export const useDashboardSummary = (days: number) =>
  useQuery<DashboardSummary, Error>({
    queryKey: ["admin-dashboard", days],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_summary", { p_days: days });
      if (error) throw new Error(error.message);
      if (!isDashboardSummary(data)) throw new Error("The dashboard returned data in an unexpected shape.");
      return data;
    },
  });
