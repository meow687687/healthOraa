import { LABEL, PANEL, cn } from "@healthoraa/ui";
import { formatDate } from "../../lib/format";
import type { ActiveProgram } from "../../types/program";

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Radial ring for overall progress, plus one segment per day for the stepper.
export function ProgressTracker({ program }: { program: ActiveProgram }) {
  const { currentDay, durationDays } = program;
  const fraction = Math.min(currentDay / durationDays, 1);
  const percent = Math.round(fraction * 100);

  return (
    <section aria-labelledby="progress-title" className={cn(PANEL, "space-y-6")}>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="8" className="stroke-aura-s3" />
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-accent-blue transition-[stroke-dashoffset] duration-700"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold tabular-nums text-white">{currentDay}</span>
            <span className="font-mono text-[11px] text-text-muted">of {durationDays}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className={LABEL}>{program.title}</p>
          <h2 id="progress-title" className="text-xl font-bold tracking-tight text-white">
            Day {currentDay} of {durationDays}
          </h2>
          <p className="text-sm text-text-secondary">
            {percent}% of the protocol completed. Ends {formatDate(program.expiresAt)}.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div role="img" aria-label={`Day ${currentDay} of ${durationDays}`} className="flex gap-[3px]">
          {Array.from({ length: durationDays }, (_, index) => {
            const day = index + 1;
            return (
              <span
                key={day}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  day < currentDay && "bg-accent-blue",
                  day === currentDay && "bg-accent-blue shadow-[0_0_10px_rgba(59,130,246,0.6)]",
                  day > currentDay && "bg-aura-s3",
                )}
              />
            );
          })}
        </div>
        <div className="flex justify-between font-mono text-[11px] text-text-muted">
          <span>Day 1</span>
          <span>Day {durationDays}</span>
        </div>
      </div>
    </section>
  );
}
