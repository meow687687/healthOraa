import { Badge, PANEL, cn } from "@healthoraa/ui";
import { formatDocumentDate } from "../../lib/fileFormat";
import { latestReading, sparklinePoints, statusOf } from "../../lib/biomarkers";
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
