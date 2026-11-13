import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "../../lib/cn";
import { percentChange } from "../../lib/format";
import type { Pair } from "../../hooks/useDashboardSummary";

export function KpiCard({
  label,
  value,
  pair,
  series,
  tone,
  note,
}: {
  label: string;
  value: string;
  pair: Pair;
  series: number[];
  tone: "blue" | "emerald" | "amber" | "violet";
  note: string;
}) {
  const change = percentChange(pair.current, pair.previous);
  const delta =
    change === null
      ? pair.current > 0
        ? { text: "New this week", tone: "text-accent-emerald", Icon: ArrowUpRight }
        : { text: "No activity", tone: "text-text-muted", Icon: Minus }
      : change >= 0
        ? { text: `${change.toFixed(0)}% vs last week`, tone: "text-accent-emerald", Icon: ArrowUpRight }
        : { text: `${Math.abs(change).toFixed(0)}% vs last week`, tone: "text-accent-red", Icon: ArrowDownRight };
  const color = { blue: "#4387F6", emerald: "#10B981", amber: "#FFB020", violet: "#8B6CFF" }[tone];

  return (
    <article className="flex flex-col rounded-3xl border border-aura-line bg-aura-s1 p-5 shadow-aura-card transition-colors duration-150 hover:border-aura-line2">
      <p className="text-[13px] font-medium text-text-muted">{label}</p>
      <p className="mt-3 font-mono text-[28px] font-semibold tabular-nums tracking-tight text-text-primary md:text-[32px]">{value}</p>
      <p className={cn("mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium", delta.tone)}>
        <delta.Icon className="h-4 w-4" aria-hidden="true" />
        {delta.text}
      </p>
      <div className="mt-4">
        <Sparkline values={series} color={color} />
      </div>
      <p className="mt-2 text-[12px] text-text-muted">{note}</p>
    </article>
  );
}

// Last seven days. Drawn as SVG so it adds nothing to the bundle.
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 240;
  const height = 40;
  const max = Math.max(...values, 0);
  if (values.length < 2) return <div className="h-10" aria-hidden="true" />;
  if (max === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" aria-hidden="true" preserveAspectRatio="none">
        <line x1="0" x2={width} y1={height - 2} y2={height - 2} stroke="#838899" strokeDasharray="4 4" strokeOpacity="0.5" />
      </svg>
    );
  }
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - 4 - (value / max) * (height - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
