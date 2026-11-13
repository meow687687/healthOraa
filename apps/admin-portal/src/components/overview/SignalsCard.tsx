import { Activity, CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatCount } from "../../lib/format";
import type { DashboardSummary } from "../../hooks/useDashboardSummary";

// Operational checks that should stay at zero. The table below uses the same numbers.
export function SignalsCard({ summary }: { summary: DashboardSummary }) {
  const rows = [
    { label: "Payment orders unpaid after 30 min", count: summary.signals.stale_payment_orders, watch: true },
    { label: "Bookings awaiting payment after 30 min", count: summary.signals.bookings_awaiting_payment, watch: true },
    { label: "Active programme enrolments", count: summary.signals.active_enrolments, watch: false },
  ];
  return (
    <section aria-labelledby="signals-title" className="rounded-3xl border border-aura-line bg-aura-s1 p-5 shadow-aura-card md:p-6 lg:col-span-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-text-muted" aria-hidden="true" />
        <h2 id="signals-title" className="text-base font-semibold text-text-primary">
          Checks
        </h2>
      </div>
      <ul className="mt-5 space-y-4">
        {rows.map((row) => {
          const healthy = row.watch ? row.count === 0 : true;
          const Icon = healthy ? CheckCircle2 : CircleAlert;
          return (
            <li key={row.label} className="flex items-start gap-3">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", healthy ? "text-accent-emerald" : "text-accent-amber")} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-text-secondary">{row.label}</span>
              </span>
              <span className="font-mono text-sm tabular-nums text-text-primary">{formatCount(row.count)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
