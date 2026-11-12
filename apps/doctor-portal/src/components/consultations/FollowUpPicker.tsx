import { cn, ERROR_TEXT, LABEL } from "@healthoraa/ui";
import { addDays, FOLLOWUP_CHIPS, formatDate } from "../../lib/prescriptionOptions";

export function FollowUpPicker({
  value,
  error,
  onChange,
}: {
  value: number;
  error?: string;
  onChange: (days: number) => void;
}) {
  const reviewDate = formatDate(addDays(new Date(), value));

  return (
    <section aria-labelledby="rx-followup-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="rx-followup-heading" className={LABEL}>
          Follow-up
        </h3>
        <span className="text-xs text-text-secondary">Review on {reviewDate}</span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Follow-up window">
        {FOLLOWUP_CHIPS.map((days) => {
          const selected = value === days;
          return (
            <button
              key={days}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(days)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                selected
                  ? "border-accent-blue/30 bg-accent-blue/10 text-accent-blue"
                  : "border-aura-line bg-aura-s2 text-text-secondary hover:text-text-primary",
              )}
            >
              {days} Days
            </button>
          );
        })}
      </div>
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </section>
  );
}
