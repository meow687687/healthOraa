import { ArrowRight } from "lucide-react";
import { Badge, PANEL, cn } from "@healthoraa/ui";
import type { ProgramCatalogItem } from "../../hooks/useProgramCatalog";
import { PROGRAM_CATEGORY_META } from "./programMeta";

export function ProgramCard({
  program,
  onSelect,
}: {
  program: ProgramCatalogItem;
  onSelect: () => void;
}) {
  const meta = PROGRAM_CATEGORY_META[program.category];
  const Icon = meta.icon;

  return (
    <article className={cn(PANEL, "flex min-w-0 flex-col gap-4 p-5")}>
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            meta.tile,
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <Badge tone="neutral">{meta.label}</Badge>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="text-base font-semibold leading-snug text-text-primary">
          {program.title}
        </h3>
        {program.description?.trim() && (
          <p className="line-clamp-3 text-sm leading-relaxed text-text-secondary">
            {program.description.trim()}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-aura-line pt-4">
        <span className="text-sm text-text-muted">
          {program.duration_days} days
        </span>
        <button
          type="button"
          onClick={onSelect}
          aria-label={`View details for ${program.title}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-primary transition-colors hover:bg-aura-s3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
        >
          View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
