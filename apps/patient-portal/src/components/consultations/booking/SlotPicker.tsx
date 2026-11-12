import { useState } from "react";
import { BTN_PRIMARY, Badge, LABEL, cn } from "@healthoraa/ui";
import { formatIstDayMonth, formatIstTime, formatIstWeekday, istDayKey, istHour } from "../../../lib/istTime";
import { formatPaise, rupeesToPaise } from "../../../lib/money";
import { nextSevenDayKeys } from "../../../lib/slotPlanner";
import type { DoctorOption, SlotOption } from "../../../types/consultations";

const CHIP =
  "rounded-full border px-4 py-2 text-xs font-mono tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20";

// Date carousel for the next seven days, then morning and evening slot blocks for the chosen day.
export function SlotPicker({
  doctor,
  slots,
  isLoading,
  selected,
  onSelect,
  onContinue,
}: {
  doctor: DoctorOption;
  slots: SlotOption[] | undefined;
  isLoading: boolean;
  selected: SlotOption | null;
  onSelect: (slot: SlotOption) => void;
  onContinue: () => void;
}) {
  const [days] = useState(() => nextSevenDayKeys(new Date()));
  // null until the reader picks a day; until then the picker opens on the first day with open slots.
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const all = slots ?? [];

  const onDay = (key: string) => all.filter((slot) => istDayKey(new Date(slot.startsAt)) === key);
  const dayKey = chosenDay ?? days.find((key) => onDay(key).length > 0) ?? days[0];
  const daySlots = onDay(dayKey);
  const morning = daySlots.filter((slot) => istHour(new Date(slot.startsAt)) < 12);
  const evening = daySlots.filter((slot) => istHour(new Date(slot.startsAt)) >= 12);

  const renderBlock = (title: string, block: SlotOption[]) => (
    <div className="space-y-3">
      <p className={LABEL}>{title}</p>
      {block.length === 0 ? (
        <p className="text-xs text-text-muted">No open slots in this block.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {block.map((slot) => {
            const on = selected?.id === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(slot)}
                className={cn(
                  CHIP,
                  on ? "border-accent-blue bg-accent-blue/15 text-accent-blue" : "border-aura-line2 bg-aura-s2 text-text-secondary hover:text-text-primary",
                )}
              >
                {formatIstTime(slot.startsAt)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-7">
      <section aria-label="Doctor" className="space-y-3 rounded-2xl border border-aura-line bg-aura-s2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-text-primary">{doctor.displayName}</p>
          <Badge tone="blue">{doctor.qualification}</Badge>
        </div>
        <p className="font-mono text-xs text-text-muted">
          {formatPaise(rupeesToPaise(doctor.feeInr))} consultation fee · {doctor.slotDurationMinutes}-minute slots
        </p>
      </section>

      <section aria-labelledby="pick-day" className="space-y-3">
        <p id="pick-day" className={LABEL}>
          Choose a day
        </p>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {days.map((key) => {
            const date = new Date(`${key}T12:00:00+05:30`);
            const open = onDay(key).length;
            const on = key === dayKey;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => setChosenDay(key)}
                className={cn(
                  "flex min-w-[5.5rem] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-colors",
                  on ? "border-accent-blue bg-accent-blue/15 text-white" : "border-aura-line2 bg-aura-s2 text-text-secondary hover:text-text-primary",
                )}
              >
                <span className="text-[11px] font-mono uppercase tracking-wider">{formatIstWeekday(date)}</span>
                <span className="text-sm font-semibold">{formatIstDayMonth(date)}</span>
                <span className="text-[11px] text-text-muted">{isLoading ? "..." : open === 0 ? "Full" : `${open} open`}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Time slots" className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Loading slots...</p>
        ) : (
          <>
            {renderBlock("Morning", morning)}
            {renderBlock("Evening", evening)}
          </>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-aura-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-secondary">
          {selected
            ? `Selected: ${formatIstWeekday(new Date(selected.startsAt))}, ${formatIstDayMonth(new Date(selected.startsAt))} at ${formatIstTime(selected.startsAt)}`
            : "Pick a time to continue."}
        </p>
        <button type="button" disabled={!selected} onClick={onContinue} className={BTN_PRIMARY}>
          Continue to intake
        </button>
      </div>
    </div>
  );
}
