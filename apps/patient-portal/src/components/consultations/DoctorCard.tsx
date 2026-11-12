import { Badge, PANEL, cn } from "@healthoraa/ui";
import { formatPaise, rupeesToPaise } from "../../lib/money";
import type { DoctorOption } from "../../types/consultations";

const initialsOf = (name: string): string =>
  name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

export function DoctorCard({ doctor, onBook }: { doctor: DoctorOption; onBook: () => void }) {
  return (
    <article className={cn(PANEL, "flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between")}>
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent-blue to-accent-violet text-sm font-bold text-white">
          {initialsOf(doctor.displayName)}
        </div>
        <div className="min-w-0 space-y-1.5">
          <h3 className="truncate text-sm font-semibold text-text-primary">{doctor.displayName}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">{doctor.qualification}</Badge>
            <Badge tone="emerald">NMC verified</Badge>
          </div>
          <p className="font-mono text-xs text-text-muted">
            {formatPaise(rupeesToPaise(doctor.feeInr))} · {doctor.slotDurationMinutes}-minute slots
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onBook}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-blue px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-accent-blue-glow transition-all hover:bg-accent-blue/90 active:scale-[0.98]"
      >
        Book consultation
      </button>
    </article>
  );
}
