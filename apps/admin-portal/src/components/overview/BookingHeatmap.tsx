import { Clock3 } from "lucide-react";
import { EmptyState } from "@healthoraa/ui";
import { cn } from "../../lib/cn";
import { formatCount } from "../../lib/format";
import type { DashboardSummary } from "../../hooks/useDashboardSummary";
import { ChartCard, ValueTable } from "./ChartCard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Clinic hours by default; widened to any hour the data contains, so no booking falls outside the grid.

// Confirmed bookings by weekday and start hour, in IST. Darker cells have more bookings.
export function BookingHeatmap({ summary }: { summary: DashboardSummary }) {
  const hours = (() => {
    const values = summary.heatmap.map((cell) => cell.hour);
    const low = Math.min(8, ...values);
    const high = Math.max(20, ...values);
    return Array.from({ length: high - low + 1 }, (_, index) => low + index);
  })();
  const columns = `48px repeat(${hours.length}, minmax(0,1fr))`;
  const counts = new Map<string, number>();
  for (const cell of summary.heatmap) counts.set(`${cell.weekday}-${cell.hour}`, cell.count);
  const max = Math.max(...summary.heatmap.map((cell) => cell.count), 0);
  const total = summary.heatmap.reduce((sum, cell) => sum + cell.count, 0);

  return (
    <ChartCard
      className="lg:col-span-8"
      title="When patients book"
      description={`Confirmed consultations by weekday and start time, IST, last ${summary.window_days} days`}
      chart={
        total === 0 ? (
          <EmptyState icon={Clock3} title="No confirmed bookings in this window" description="Bookings show here by weekday and time." />
        ) : (
          <div className="overflow-x-auto">
            <div role="table" aria-label="Bookings by weekday and hour" className="min-w-[520px]">
              <div role="row" className="grid gap-1 pb-1 text-[11px] text-text-muted" style={{ gridTemplateColumns: columns }}>
                <span role="columnheader" className="sr-only">
                  Day
                </span>
                {hours.map((hour) => (
                  <span key={hour} role="columnheader" className="text-center font-mono tabular-nums">
                    {hour % 4 === 0 ? `${hour}h` : ""}
                  </span>
                ))}
              </div>
              {DAYS.map((day, dayIndex) => (
                <div key={day} role="row" className="grid items-center gap-1 py-0.5" style={{ gridTemplateColumns: columns }}>
                  <span role="rowheader" className="text-[12px] text-text-secondary">
                    {day}
                  </span>
                  {hours.map((hour) => {
                    const count = counts.get(`${dayIndex + 1}-${hour}`) ?? 0;
                    const intensity = max === 0 ? 0 : count / max;
                    return (
                      <span
                        key={hour}
                        role="cell"
                        aria-label={`${day} ${hour}:00, ${count} bookings`}
                        title={`${day} ${hour}:00, ${count} bookings`}
                        className={cn("h-7 rounded-md", count === 0 && "bg-aura-s2")}
                        style={count > 0 ? { backgroundColor: `rgba(67, 135, 246, ${0.18 + intensity * 0.82})` } : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[12px] text-text-muted" aria-hidden="true">
              <span>Fewer</span>
              {[0.2, 0.4, 0.6, 0.8, 1].map((level) => (
                <span key={level} className="h-3 w-6 rounded-sm" style={{ backgroundColor: `rgba(67, 135, 246, ${level})` }} />
              ))}
              <span>More</span>
            </div>
          </div>
        )
      }
      table={
        <ValueTable
          caption="Confirmed bookings by weekday and hour"
          columns={["Bookings"]}
          rows={summary.heatmap
            .slice()
            .sort((a, b) => b.count - a.count)
            .map((cell) => ({
              label: `${DAYS[cell.weekday - 1]} ${String(cell.hour).padStart(2, "0")}:00`,
              values: [formatCount(cell.count)],
            }))}
        />
      }
    />
  );
}
