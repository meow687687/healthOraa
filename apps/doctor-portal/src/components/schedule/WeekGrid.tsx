import { DAY_NAMES, DAY_ORDER, slotsForDay } from "../../lib/scheduleGenerator";
import type { WindowDraft } from "../../types/schedule";
import { PANEL, cn } from "@healthoraa/ui";

// Day strip on every screen. The time grid appears from the medium breakpoint up.
const FIRST_MINUTE = 6 * 60;
const LAST_MINUTE = 22 * 60;
const HOURS = Array.from({ length: (LAST_MINUTE - FIRST_MINUTE) / 60 + 1 }, (_, index) => FIRST_MINUTE / 60 + index);
const SPAN = LAST_MINUTE - FIRST_MINUTE;
const HALF_HOURS = Array.from({ length: SPAN / 30 + 1 }, (_, index) => FIRST_MINUTE + index * 30);

const toMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
};
const clamp = (minute: number): number => Math.min(Math.max(minute, FIRST_MINUTE), LAST_MINUTE);
const percent = (minute: number): string => `${((clamp(minute) - FIRST_MINUTE) / SPAN) * 100}%`;

export function WeekGrid({
  rules,
  durationMinutes,
  selectedDay,
  onSelect,
  invalidDays,
}: {
  rules: WindowDraft[];
  durationMinutes: number;
  selectedDay: number;
  onSelect: (dayOfWeek: number) => void;
  // Days with a window that cannot be saved. Marked here, so an error stays visible when another day is open.
  invalidDays: Set<number>;
}) {
  // Keep enough width for legible time labels while letting the day columns share remaining space.
  const columns = "grid-cols-7 md:grid-cols-[36px_repeat(7,minmax(68px,1fr))]";

  return (
    <section aria-label="Week overview" className={cn(PANEL, "p-4 md:p-5")}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-aura-line pb-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Weekly availability</h3>
          <p className="mt-0.5 text-xs text-text-muted">Select a day to edit its time windows.</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm border border-accent-emerald/50 bg-accent-emerald/25" />
          Available
        </span>
      </header>

      <div className={cn("grid gap-1.5", columns)} role="group" aria-label="Choose a day to edit">
        <span aria-hidden="true" className="hidden md:block" />
        {DAY_ORDER.map((day) => {
          const count = slotsForDay(rules, day, durationMinutes);
          const selected = selectedDay === day;
          const invalid = invalidDays.has(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(day)}
              className={cn(
                "min-h-[58px] min-w-0 rounded-2xl border px-1 py-2 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/70",
                selected
                  ? "border-accent-blue/60 bg-accent-blue/10 text-text-primary shadow-aura-elevated"
                  : "border-aura-line bg-aura-s2 text-text-secondary hover:border-aura-line2 hover:text-text-primary",
              )}
            >
              {invalid && <span className="sr-only">, has an error</span>}
              {invalid && <span aria-hidden="true" className="mx-auto mb-0.5 block h-1.5 w-1.5 rounded-full bg-accent-amber" />}
              <span className="block truncate text-[13px] font-semibold md:hidden">{DAY_NAMES[day].slice(0, 2)}</span>
              <span className="hidden truncate text-[13px] font-semibold md:block">{DAY_NAMES[day].slice(0, 3)}</span>
              <span className="block truncate font-mono text-[11px] tabular-nums text-text-secondary md:hidden">{count}</span>
              <span className="hidden truncate font-mono text-[10px] tabular-nums text-text-secondary md:block">
                {count === 0 ? "No slots" : `${count} slots`}
              </span>
            </button>
          );
        })}
      </div>

      <div className={cn("mt-3 hidden gap-1.5 md:grid", columns)}>
        <div className="relative h-[22rem]">
          {HOURS.map((hour) => (
            <span
              key={hour}
              className="absolute right-1 -translate-y-1/2 font-mono text-[11px] tabular-nums text-text-muted"
              style={{ top: percent(hour * 60) }}
            >
              {String(hour).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {DAY_ORDER.map((day) => (
          <div
            key={day}
            className={cn(
              "relative h-[22rem] overflow-hidden rounded-xl border",
              selectedDay === day ? "border-accent-blue/50 bg-accent-blue/[0.035]" : "border-aura-line bg-aura-s2/40",
            )}
          >
            {HALF_HOURS.map((minute) => (
              <div
                key={minute}
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 border-t",
                  minute % 60 === 0 ? "border-aura-line/70" : "border-aura-line/30 border-dashed",
                )}
                style={{ top: percent(minute) }}
              />
            ))}
            {rules
              .filter((rule) => rule.day_of_week === day && rule.is_active)
              .map((rule) => {
                const start = toMinutes(rule.start_time);
                const end = toMinutes(rule.end_time);
                const visibleDuration = Math.min(end, LAST_MINUTE) - Math.max(start, FIRST_MINUTE);

                return (
                  <div
                    key={rule.id}
                    title={`Available ${rule.start_time} to ${rule.end_time}`}
                    className="absolute inset-x-1 overflow-hidden rounded-xl border border-accent-emerald/35 border-l-2 border-l-accent-emerald bg-gradient-to-br from-accent-emerald/20 via-accent-emerald/10 to-accent-blue/10 px-1 py-1 font-mono text-[10px] leading-tight tabular-nums text-text-primary shadow-sm"
                    style={{
                      top: percent(start),
                      height: `${(visibleDuration / SPAN) * 100}%`,
                    }}
                  >
                    <span className="sr-only">Available {rule.start_time} to {rule.end_time}</span>
                    {visibleDuration >= 120 && (
                      <span aria-hidden="true" className="mb-0.5 flex items-center gap-1 text-[8px] font-semibold uppercase leading-none tracking-wider text-accent-emerald">
                        <span className="h-1 w-1 rounded-full bg-accent-emerald" />
                        Open
                      </span>
                    )}
                    <span aria-hidden="true" className="block whitespace-nowrap leading-none">{visibleDuration >= 60 ? rule.start_time : ""}</span>
                    {visibleDuration >= 120 && (
                      <span aria-hidden="true" className="mt-0.5 block whitespace-nowrap text-[9px] leading-none text-accent-emerald">
                        ↓ {rule.end_time}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
