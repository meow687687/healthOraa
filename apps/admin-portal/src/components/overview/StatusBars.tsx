import { Package } from "lucide-react";
import { EmptyState } from "@healthoraa/ui";
import { formatCount } from "../../lib/format";
import { cn } from "../../lib/cn";
import type { DashboardSummary } from "../../hooks/useDashboardSummary";
import { ChartCard, ValueTable } from "./ChartCard";

// Orders in the order they flow through the business. A bar is the share of the largest status.
const FLOW: { key: string; label: string; tone: string }[] = [
  { key: "pending", label: "Pending", tone: "bg-accent-amber" },
  { key: "paid", label: "Paid", tone: "bg-accent-blue" },
  { key: "shipped", label: "Shipped", tone: "bg-accent-violet" },
  { key: "delivered", label: "Delivered", tone: "bg-accent-emerald" },
  { key: "cancelled", label: "Cancelled", tone: "bg-text-muted" },
];

export function StatusBars({ summary }: { summary: DashboardSummary }) {
  const counts = FLOW.map((step) => ({ ...step, count: summary.orders_by_status[step.key] ?? 0 }));
  const max = Math.max(...counts.map((step) => step.count), 0);
  const total = counts.reduce((sum, step) => sum + step.count, 0);

  return (
    <ChartCard
      className="lg:col-span-4"
      title="Orders by status"
      description={`${formatCount(total)} orders in the last ${summary.window_days} days`}
      chart={
        total === 0 ? (
          <EmptyState icon={Package} title="No orders in this window" description="Shop orders appear here as they are placed." />
        ) : (
          <ul className="space-y-4">
            {counts.map((step) => (
              <li key={step.key}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-text-secondary">{step.label}</span>
                  <span className="font-mono tabular-nums text-text-primary">{formatCount(step.count)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-aura-s3" aria-hidden="true">
                  <div
                    className={cn("h-full rounded-full", step.tone)}
                    style={{ width: max === 0 ? "0%" : `${(step.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      }
      table={<ValueTable caption="Orders by status" columns={["Orders"]} rows={counts.map((step) => ({ label: step.label, values: [formatCount(step.count)] }))} />}
    />
  );
}
