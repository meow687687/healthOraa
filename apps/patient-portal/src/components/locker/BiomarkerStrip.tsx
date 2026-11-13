import { Badge, PANEL, cn } from "@healthoraa/ui";
import { formatDocumentDate } from "../../lib/fileFormat";
import { latestReading, sparklinePoints, statusOf } from "../../lib/biomarkers";

// Where the latest value sits between the reference bounds. Drawn only when both bounds are known.
function RangeBar({ biomarker }: { biomarker: Biomarker }) {
  const { min, max } = biomarker.range;
  const value = latestReading(biomarker).value;
  if (min === undefined || max === undefined || max <= min) return null;
  const low = min - (max - min) * 0.5;
  const high = max + (max - min) * 0.5;
  const toPercent = (x: number) => `${Math.min(100, Math.max(0, ((x - low) / (high - low)) * 100))}%`;
  return (
    <div className="space-y-1" role="img" aria-label={`${value} ${biomarker.unit}, reference ${min} to ${max}`}>
      <div className="relative h-2 rounded-full bg-aura-s3">
        <div className="absolute inset-y-0 rounded-full bg-accent-emerald/30" style={{ left: toPercent(min), right: `${100 - Number.parseFloat(toPercent(max))}%` }} />
        <span className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary" style={{ left: toPercent(value) }} />
      </div>
    </div>
  );
}
import type { Biomarker } from "../../types/locker";

function BiomarkerCard({ biomarker }: { biomarker: Biomarker }) {
  const status = statusOf(biomarker);
  const latest = latestReading(biomarker);

  return (
    <article className={cn(PANEL, "space-y-3 p-5")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-mono uppercase tracking-wider text-text-muted">{biomarker.label}</p>
        <Badge tone={status === "healthy" ? "emerald" : "amber"}>{status === "healthy" ? "Healthy" : "Elevated"}</Badge>
      </div>
      <p className="font-mono text-2xl font-bold tabular-nums text-white">
        {latest.value} <span className="text-sm font-medium text-text-muted">{biomarker.unit}</span>
      </p>
      <RangeBar biomarker={biomarker} />
      {biomarker.readings.length >= 2 ? (
        <svg viewBox="0 0 120 36" preserveAspectRatio="none" className="h-9 w-full" aria-hidden="true">
          <polyline
            points={sparklinePoints(biomarker, 120, 36)}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className={status === "healthy" ? "stroke-accent-emerald" : "stroke-accent-amber"}
          />
        </svg>
      ) : (
        <p className="text-[12px] text-text-muted">One result so far. A trend appears after the next test.</p>
      )}
      <p className="text-[11px] text-text-muted">
        {biomarker.referenceLabel} · {formatDocumentDate(latest.date)}
      </p>
    </article>
  );
}

// Latest value and trend for each biomarker, with an indicator for healthy or elevated.
export function BiomarkerStrip({ biomarkers }: { biomarkers: Biomarker[] }) {
  return (
    <section aria-label="Biomarker summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {biomarkers.map((biomarker) => (
        <BiomarkerCard key={biomarker.key} biomarker={biomarker} />
      ))}
    </section>
  );
}
