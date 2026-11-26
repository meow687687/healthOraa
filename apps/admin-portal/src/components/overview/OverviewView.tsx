import { Suspense, lazy, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SkeletonBlock } from "@healthoraa/ui";
import { ERROR_BOX } from "../ui/tokens";
import { cn } from "../../lib/cn";
import { formatCount, formatInrCompact, formatInrFull } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import {
  useDashboardSummary,
  type DashboardSummary,
} from "../../hooks/useDashboardSummary";
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

export function OverviewView({
  onNavigate,
}: {
  onNavigate: (id: TabId) => void;
}) {
  const [days, setDays] = useState<number>(30);
  const { isPrototype } = useAuth();
  const summary = useDashboardSummary(days, isPrototype);

  return (
    <div className="space-y-3 md:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-text-muted">
          Key figures compare the last 7 days with the prior 7. Trends use the
          selected window.
        </p>
        <div
          role="group"
          aria-label="Time window"
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-aura-line2 bg-aura-s1 p-1"
        >
          {WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
              className={cn(
                "min-h-[44px] rounded-full px-4 text-[13px] font-semibold transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue",
                days === option
                  ? "bg-aura-s3 text-text-primary"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      {isPrototype ? (
        <p
          role="status"
          className="rounded-2xl border border-aura-line bg-aura-s1 px-4 py-3 text-[13px] text-text-secondary"
        >
          <span className="font-semibold text-text-primary">
            Prototype preview.
          </span>{" "}
          Figures are synthetic examples. Payment totals are zero, and no live
          admin or payment records are queried.
        </p>
      ) : null}

      {summary.isPending ? (
        <OverviewSkeleton isPrototype={isPrototype} />
      ) : summary.isError ? (
        <div className="space-y-3">
          <div role="alert" className={ERROR_BOX}>
            The overview could not load. Check your connection and try again.
          </div>
          <button
            type="button"
            onClick={() => void summary.refetch()}
            className="min-h-[44px] rounded-full border border-aura-line2 px-4 text-[13px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : (
        <Dashboard summary={summary.data} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function Dashboard({
  summary,
  onNavigate,
}: {
  summary: DashboardSummary;
  onNavigate: (id: TabId) => void;
}) {
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(min-width: 1024px)").matches === true,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => setIsDesktopViewport(media.matches);
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);
  return (
    <>
      <AttentionStrip summary={summary} onNavigate={onNavigate} />

      <section aria-labelledby="kpi-title" className="space-y-3">
        <h2 id="kpi-title" className="sr-only">
          Key figures
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            label="Captured revenue"
            value={formatInrCompact(summary.kpis.revenue_inr.current)}
            pair={summary.kpis.revenue_inr}
            note={`${formatInrFull(summary.kpis.revenue_inr.current)} captured`}
          />
          <KpiCard
            label="Orders"
            value={formatCount(summary.kpis.orders.current)}
            pair={summary.kpis.orders}
            note="Shop orders placed"
          />
          <KpiCard
            label="Consultation bookings"
            value={formatCount(summary.kpis.bookings.current)}
            pair={summary.kpis.bookings}
            note="Confirmed after payment"
          />
          <KpiCard
            label="New enrolments"
            value={formatCount(summary.kpis.enrolments.current)}
            pair={summary.kpis.enrolments}
            note={`${formatCount(summary.signals.active_enrolments)} plans active now`}
          />
        </div>
      </section>

      <button
        type="button"
        aria-expanded={showAnalytics}
        aria-controls="overview-analytics"
        onClick={() => setShowAnalytics((show) => !show)}
        className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-aura-line2 bg-aura-s1 px-4 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-aura-s2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue lg:hidden"
      >
        <span>
          {showAnalytics
            ? "Hide trends and breakdowns"
            : "Show trends and breakdowns"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            showAnalytics && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <section
        id="overview-analytics"
        aria-label="Trends and breakdowns"
        className={cn(
          "grid grid-cols-1 gap-4 lg:grid-cols-12",
          !showAnalytics && "hidden lg:grid",
        )}
      >
        {showAnalytics || isDesktopViewport ? (
          <>
            <Suspense fallback={<ChartFallback />}>
              <RevenueChart summary={summary} />
            </Suspense>
            <StatusBars summary={summary} />
            <ConsultationFunnel summary={summary} />
            <BookingHeatmap summary={summary} />
          </>
        ) : null}
      </section>

      <section
        aria-label="Activity and checks"
        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12"
      >
        <ActivityFeed onOpen={(kind) => onNavigate(ACTIVITY_TARGET[kind])} />
        <TopProducts summary={summary} />
        <SignalsCard summary={summary} />
      </section>
    </>
  );
}

function ChartFallback() {
  return (
    <div
      className="rounded-3xl border border-aura-line bg-aura-s1 p-6 lg:col-span-8"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <SkeletonBlock className="h-64" />
    </div>
  );
}

function OverviewSkeleton({ isPrototype }: { isPrototype: boolean }) {
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
      <p className="text-center text-[13px] text-text-muted">
        {isPrototype
          ? "Preparing synthetic prototype figures."
          : "Loading figures from the latest orders, payments and bookings."}
      </p>
    </div>
  );
}
