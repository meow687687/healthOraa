import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@healthoraa/ui";
import { formatCount } from "../../lib/format";
import type { DashboardSummary } from "../../hooks/useDashboardSummary";
import { ChartCard } from "./ChartCard";

// Each step is measured against the step before it, so the drop-off point is visible.
export function ConsultationFunnel({ summary }: { summary: DashboardSummary }) {
  const steps = [
    { label: "Slots published", value: summary.funnel.slots_published },
    { label: "Booked", value: summary.funnel.booked },
    { label: "Paid", value: summary.funnel.paid },
    { label: "Completed", value: summary.funnel.completed },
  ];
  const top = steps[0].value;

  return (
    <ChartCard
      className="lg:col-span-4"
      title="Consultation funnel"
      description={`From published slot to completed visit, last ${summary.window_days} days`}
      chart={
        top === 0 ? (
          <EmptyState icon={CalendarCheck} title="No slots published" description="Publish a week of slots to start the funnel." />
        ) : (
          <ol className="space-y-4">
            {steps.map((step, index) => {
              const share = (step.value / top) * 100;
              const previous = index === 0 ? null : steps[index - 1].value;
              const conversion = previous && previous > 0 ? Math.round((step.value / previous) * 100) : null;
              return (
                <li key={step.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-text-secondary">{step.label}</span>
                    <span className="font-mono tabular-nums text-text-primary">
                      {formatCount(step.value)}
                      {conversion !== null ? <span className="ml-2 text-text-muted">{conversion}%</span> : null}
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-aura-s3" aria-hidden="true">
                    <div className="h-full rounded-full bg-accent-blue" style={{ width: `${Math.max(share, 2)}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )
      }
    />
  );
}
