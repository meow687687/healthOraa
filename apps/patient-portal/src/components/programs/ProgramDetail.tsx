import { ArrowLeft, ExternalLink, Play } from "lucide-react";
import { PANEL, cn } from "@healthoraa/ui";
import type { ProgramCatalogItem } from "../../hooks/useProgramCatalog";
import { PROGRAM_CATEGORY_META } from "./programMeta";

export function ProgramDetail({
  program,
  onBack,
}: {
  program: ProgramCatalogItem;
  onBack: () => void;
}) {
  const meta = PROGRAM_CATEGORY_META[program.category];
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-aura-s2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to programs
      </button>

      <article className={cn(PANEL, "overflow-hidden")}>
        <header className="border-b border-aura-line p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                meta.tile,
              )}
              aria-hidden="true"
            >
              <Icon className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                {meta.label}
              </p>
              <h2
                id="program-detail-title"
                className="text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl"
              >
                {program.title}
              </h2>
              <p className="text-sm text-text-secondary">
                {program.duration_days} days
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-5 sm:p-7">
          <section
            aria-labelledby="program-overview-title"
            className="space-y-2"
          >
            <h3
              id="program-overview-title"
              className="text-sm font-semibold text-text-primary"
            >
              Program overview
            </h3>
            <p className="max-w-3xl whitespace-pre-line text-sm leading-7 text-text-secondary">
              {program.description?.trim() ||
                "A program overview has not been added yet."}
            </p>
          </section>

          {program.intro_video_url && (
            <section
              aria-labelledby="program-video-title"
              className="space-y-3"
            >
              <h3
                id="program-video-title"
                className="text-sm font-semibold text-text-primary"
              >
                Introduction
              </h3>
              <a
                href={program.intro_video_url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                aria-label={`Open the introduction video for ${program.title} in a new tab`}
                className={cn(
                  PANEL,
                  "flex min-h-16 items-center gap-3 p-4 text-sm font-semibold text-text-primary transition-colors hover:bg-aura-s3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue",
                )}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-aura-s3 text-accent-blue"
                  aria-hidden="true"
                >
                  <Play className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  Watch the introduction video
                </span>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-text-muted"
                  aria-hidden="true"
                />
              </a>
              <p className="text-xs text-text-muted">
                Opens on the video host in a new tab.
              </p>
            </section>
          )}

          <p
            role="note"
            className="rounded-2xl border border-aura-line bg-aura-s2 px-4 py-3 text-sm leading-relaxed text-text-secondary"
          >
            This is an information preview. Enrollment and payment are not
            available from this page.
          </p>
        </div>
      </article>
    </div>
  );
}
