import type {
  DailyPoint,
  DashboardSummary,
} from "../hooks/useDashboardSummary";

const DAY_MS = 24 * 60 * 60 * 1000;

function indiaDate(daysAgo: number, now: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now.getTime() - daysAgo * DAY_MS));
  const get = (type: "year" | "month" | "day"): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function samplePoint(daysAgo: number, now: Date): DailyPoint {
  return {
    day: indiaDate(daysAgo, now),
    revenue_inr: 0,
    orders: [1, 4, 9].includes(daysAgo) ? 1 : 0,
    bookings: 0,
    enrolments: [3, 10].includes(daysAgo) ? 1 : 0,
  };
}

function total(
  points: DailyPoint[],
  key: "orders" | "bookings" | "enrolments",
): number {
  return points.reduce((sum, point) => sum + point[key], 0);
}

export function buildPrototypeDashboardSummary(
  days: number,
  now = new Date(),
): DashboardSummary {
  const windowDays = Math.min(90, Math.max(7, Math.floor(days)));
  const daily = Array.from({ length: windowDays }, (_, index) =>
    samplePoint(windowDays - index - 1, now),
  );
  const recentWeeks = Array.from({ length: 14 }, (_, index) =>
    samplePoint(index, now),
  );
  const currentWeek = recentWeeks.slice(0, 7);
  const previousWeek = recentWeeks.slice(7, 14);
  const pendingOrders = total(daily, "orders");

  return {
    generated_at: now.toISOString(),
    window_days: windowDays,
    attention: {
      pending_verifications: 1,
      failed_payments_24h: 0,
      paid_unshipped: 0,
      low_stock: 1,
      open_compliance: 1,
    },
    signals: {
      stale_payment_orders: 0,
      bookings_awaiting_payment: 1,
      active_enrolments: 2,
    },
    kpis: {
      revenue_inr: { current: 0, previous: 0 },
      orders: {
        current: total(currentWeek, "orders"),
        previous: total(previousWeek, "orders"),
      },
      bookings: { current: 0, previous: 0 },
      enrolments: {
        current: total(currentWeek, "enrolments"),
        previous: total(previousWeek, "enrolments"),
      },
    },
    daily,
    revenue_previous_daily: Array.from({ length: windowDays }, (_, index) => ({
      day: indiaDate(windowDays * 2 - index - 1, now),
      revenue_inr: 0,
    })),
    orders_by_status: pendingOrders > 0 ? { pending: pendingOrders } : {},
    funnel: { slots_published: 5, booked: 1, paid: 0, completed: 0 },
    heatmap: [],
    top_products: [],
  };
}
