import { cn } from "@healthoraa/ui";

export type LockerFilter = "all" | "blood" | "imaging" | "prescriptions";

export const FILTER_OPTIONS: { id: LockerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "blood", label: "Blood Panels" },
  { id: "imaging", label: "Imaging/Scans" },
  { id: "prescriptions", label: "Prescriptions" },
];

// Segmented bar of category filters, each with its count.
export function CategoryFilter({
  value,
  counts,
  onChange,
}: {
  value: LockerFilter;
  counts: Record<LockerFilter, number>;
  onChange: (next: LockerFilter) => void;
}) {
  return (
    <div role="group" aria-label="Filter documents by category" className="flex w-full flex-wrap gap-1 rounded-full border border-aura-line bg-aura-s1 p-1 sm:w-fit">
      {FILTER_OPTIONS.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20",
              on ? "bg-aura-s3 text-white" : "text-text-muted hover:text-text-primary",
            )}
          >
            {option.label}
            <span className="font-mono text-[11px] tabular-nums text-text-muted">{counts[option.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
