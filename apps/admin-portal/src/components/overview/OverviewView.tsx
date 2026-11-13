import { Suspense, lazy, useState } from "react";
import { SkeletonBlock } from "@healthoraa/ui";
import { ERROR_BOX } from "../ui/tokens";
import { cn } from "../../lib/cn";
import { formatCount, formatInrCompact, formatInrFull } from "../../lib/format";
import { useDashboardSummary, type DashboardSummary } from "../../hooks/useDashboardSummary";
import type { ActivityEvent } from "../../hooks/useRecentActivity";
import type { TabId } from "../shell/navConfig";
import { ActivityFeed } from "./ActivityFeed";
import { AttentionStrip } from "./AttentionStrip";
import { BookingHeatmap } from "./BookingHeatmap";
import { ConsultationFunnel } from "./ConsultationFunnel";
import { KpiCard } from "./KpiCard";
import { SignalsCard } from "./SignalsCard";
import { StatusBars } from "./StatusBars";
import { TopProducts } from "./TopProducts";

// Recharts is loaded only when the overview opens.
const RevenueChart = lazy(() => import("./RevenueChart"));

const WINDOWS = [7, 30, 90] as const;

const ACTIVITY_TARGET: Record<ActivityEvent["kind"], TabId> = {
  order: "orders",
  payment: "finance",
  registration: "practitioners",
};

export function OverviewView({ onNavigate }: { onNavigate: (id: TabId) => void }) {
  const [days, setDays] = useState<number>(30);
  const summary = useDashboardSummary(days);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-text-muted">
          Key figures compare the last 7 days with the 7 days before. Funnel, status and product figures use the window you choose.
        </p>
        <div role="group" aria-label="Time window" className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-aura-line2 bg-aura-s1 p-1">
          {WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
              className={cn(
                "min-h-[40px] rounded-full px-4 text-[13px] font-semibold transition-colors duration-150 cursor-pointer",
                days === option ? "bg-aura-s3 text-text-primary" : "text-text-muted hover:text-text-primary",
              )}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      {summary.isPending ? (
        <OverviewSkeleton />
      ) : summary.isError ? (
        <div className="space-y-3">
          <div role="alert" className={ERROR_BOX}>The overview could not load. {summary.error.message}</div>
          <button type="button" onClick={() => void summary.refetch()} className="min-h-[44px] rounded-full border border-aura-line2 px-4 text-[13px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer">
            Try again
          </button>
        </div>
      ) : (
        <Dashboard summary={summary.data} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function Dashboard({ summary, onNavigate }: { summary: DashboardSummary; onNavigate: (id: TabId) => void }) {
  const last7 = summary.daily.slice(-7);
  return (
    <>
      <AttentionStrip summary={summary} onNavigate={onNavigate} />

      <section aria-labelledby="kpi-title" className="space-y-3">
        <h2 id="kpi-title" className="sr-only">
          Key figures
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Captured revenue, 7 days"
            value={formatInrCompact(summary.kpis.revenue_inr.current)}
            pair={summary.kpis.revenue_inr}
            series={last7.map((point) => point.revenue_inr)}
            tone="blue"
            note={`${formatInrFull(summary.kpis.revenue_inr.current)} captured`}
          />
          <KpiCard
            label="Orders, 7 days"
            value={formatCount(summary.kpis.orders.current)}
            pair={summary.kpis.orders}
            series={last7.map((point) => point.orders)}
            tone="violet"
            note="Shop orders placed"
          />
          <KpiCard
            label="Consultations booked, 7 days"
            value={formatCount(summary.kpis.bookings.current)}
            pair={summary.kpis.bookings}
            series={last7.map((point) => point.bookings)}
            tone="emerald"
            note="Confirmed after payment"
          />
          <KpiCard
            label="New programme enrolments, 7 days"
            value={formatCount(summary.kpis.enrolments.current)}
            pair={summary.kpis.enrolments}
            series={last7.map((point) => point.enrolments)}
            tone="amber"
            note={`${formatCount(summary.signals.active_enrolments)} plans active now`}
          />
        </div>
      </section>

      <section aria-label="Trends and breakdowns" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Suspense fallback={<ChartFallback />}>
          <RevenueChart summary={summary} />
        </Suspense>
        <StatusBars summary={summary} />
        <ConsultationFunnel summary={summary} />
        <BookingHeatmap summary={summary} />
      </section>

      <section aria-label="Activity and checks" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ActivityFeed onOpen={(kind) => onNavigate(ACTIVITY_TARGET[kind])} />
        <TopProducts summary={summary} />
        <SignalsCard summary={summary} />
      </section>
    </>
  );
}

function ChartFallback() {
  return (
    <div className="rounded-3xl border border-aura-line bg-aura-s1 p-6 lg:col-span-8" aria-busy="true" aria-label="Loading chart">
      <SkeletonBlock className="h-64" />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading overview">
      <SkeletonBlock className="h-40" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <SkeletonBlock key={card} className="h-48" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SkeletonBlock className="h-80 lg:col-span-8" />
        <SkeletonBlock className="h-80 lg:col-span-4" />
      </div>
      <p className="text-center text-[13px] text-text-muted">Loading figures from the latest orders, payments and bookings.</p>
    </div>
  );
}
