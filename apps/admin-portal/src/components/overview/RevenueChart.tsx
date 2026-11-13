import { Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, ComposedChart } from "recharts";
import { EmptyState } from "@healthoraa/ui";
import { BarChart3 } from "lucide-react";
import { formatInrCompact, formatInrFull, formatIstDay } from "../../lib/format";
import type { DashboardSummary } from "../../hooks/useDashboardSummary";
import { ChartCard, ValueTable } from "./ChartCard";

// Loaded on demand from OverviewView, so the rest of the admin does not download Recharts.
export default function RevenueChart({ summary }: { summary: DashboardSummary }) {
  const previous = summary.revenue_previous_daily.map((point) => point.revenue_inr);
  const rows = summary.daily.map((point, index) => ({
    day: point.day,
    label: formatIstDay(point.day),
    current: point.revenue_inr,
    previous: previous[index] ?? 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.current, 0);
  const hasData = rows.some((row) => row.current > 0 || row.previous > 0);

  return (
    <ChartCard
      className="lg:col-span-8"
      title="Captured revenue"
      description={`Last ${summary.window_days} days, against the ${summary.window_days} days before. ${formatInrFull(total)} captured.`}
      chart={
        hasData ? (
          <div className="h-64 w-full" role="img" aria-label={`Captured revenue over ${summary.window_days} days, total ${formatInrFull(total)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4387F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4387F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1D2130" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#838899", fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tickFormatter={formatInrCompact} tick={{ fill: "#838899", fontSize: 12 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip
                  cursor={{ stroke: "#838899", strokeOpacity: 0.4 }}
                  contentStyle={{ background: "#1D2130", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, color: "#F4F6FB", fontSize: 13 }}
                  formatter={(value, name) => [formatInrFull(Number(value)), name === "current" ? "This period" : "Previous period"]}
                  labelFormatter={(label) => String(label)}
                />
                <Area type="monotone" dataKey="current" stroke="#4387F6" strokeWidth={2} fill="url(#revenueFill)" isAnimationActive={false} />
                <Line type="monotone" dataKey="previous" stroke="#838899" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={BarChart3} title="No captured payments yet" description="Revenue appears here once payments are captured." />
        )
      }
      table={
        <ValueTable
          caption="Captured revenue by day"
          rows={rows.map((row) => ({ label: row.label, values: [formatInrFull(row.current), formatInrFull(row.previous)] }))}
        />
      }
    />
  );
}
