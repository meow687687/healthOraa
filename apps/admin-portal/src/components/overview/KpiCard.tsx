import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "../../lib/cn";
import { percentChange } from "../../lib/format";
import type { Pair } from "../../hooks/useDashboardSummary";

export function KpiCard({
  label,
  value,
  pair,
  note,
}: {
  label: string;
  value: string;
  pair: Pair;
  note: string;
}) {
  const change = percentChange(pair.current, pair.previous);
  const delta =
    change === null
      ? pair.current > 0
        ? {
            text: "New in last 7 days",
            tone: "text-accent-emerald",
            Icon: ArrowUpRight,
          }
        : { text: "No activity", tone: "text-text-muted", Icon: Minus }
      : change >= 0
        ? {
            text: `${change.toFixed(0)}% vs prior 7 days`,
            tone: "text-accent-emerald",
            Icon: ArrowUpRight,
          }
        : {
            text: `${Math.abs(change).toFixed(0)}% vs prior 7 days`,
            tone: "text-accent-red",
            Icon: ArrowDownRight,
          };
  return (
    <article className="flex min-w-0 min-h-40 flex-col rounded-3xl border border-aura-line bg-aura-s1 p-4 shadow-aura-card transition-colors duration-150 hover:border-aura-line2 sm:p-5">
      <p className="text-[13px] font-medium text-text-muted">{label}</p>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight text-text-primary sm:mt-4 sm:text-[28px] md:text-[32px]">
        {value}
      </p>
      <p
        className={cn(
          "mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium sm:mt-2",
          delta.tone,
        )}
      >
        <delta.Icon className="h-4 w-4" aria-hidden="true" />
        {delta.text}
      </p>
      <p className="mt-auto pt-2 text-[12px] text-text-muted sm:pt-4">{note}</p>
    </article>
  );
}
