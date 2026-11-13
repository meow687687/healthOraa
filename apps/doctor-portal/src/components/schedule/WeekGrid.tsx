import { DAY_NAMES, DAY_ORDER } from "../../lib/scheduleGenerator";
import type { WindowDraft } from "../../types/schedule";
import { PANEL, cn } from "@healthoraa/ui";

// Day strip on every screen. The time grid appears from the medium breakpoint up.
const FIRST_MINUTE = 6 * 60;
const LAST_MINUTE = 22 * 60;
const HOURS = Array.from({ length: (LAST_MINUTE - FIRST_MINUTE) / 60 + 1 }, (_, index) => FIRST_MINUTE / 60 + index);
const SPAN = LAST_MINUTE - FIRST_MINUTE;

const toMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
};
const clamp = (minute: number): number => Math.min(Math.max(minute, FIRST_MINUTE), LAST_MINUTE);
const percent = (minute: number): string => `${((clamp(minute) - FIRST_MINUTE) / SPAN) * 100}%`;

// Bookable slots a day would produce: each active window, cut into whole slots.
export const slotsForDay = (rules: WindowDraft[], dayOfWeek: number, durationMinutes: number): number =>
  rules
    .filter((rule) => rule.day_of_week === dayOfWeek && rule.is_active)
    .reduce((sum, rule) => sum + Math.max(0, Math.floor((toMinutes(rule.end_time) - toMinutes(rule.start_time)) / durationMinutes)), 0);

export function WeekGrid({
  rules,
  durationMinutes,
  selectedDay,
  onSelect,
}: {
  rules: WindowDraft[];
  durationMinutes: number;
  selectedDay: number;
  onSelect: (dayOfWeek: number) => void;
}) {
  // Seven equal columns on phones. The time-label column joins them from the medium breakpoint.
  const columns = "grid-cols-7 md:grid-cols-[44px_repeat(7,minmax(0,1fr))]";

  return (
    <section aria-label="Week overview" className={cn(PANEL, "p-4 md:p-5")}>
      <div className={cn("grid gap-2", columns)} role="group" aria-label="Choose a day to edit">
        <span aria-hidden="true" className="hidden md:block" />
        {DAY_ORDER.map((day) => {
          const count = slotsForDay(rules, day, durationMinutes);
          const selected = selectedDay === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(day)}
              className={cn(
                "min-h-[52px] min-w-0 rounded-2xl border px-1 py-2 text-center transition-colors cursor-pointer",
                selected ? "border-accent-blue/50 bg-aura-s3 text-text-primary" : "border-aura-line bg-aura-s2 text-text-secondary hover:text-text-primary",
              )}
            >
              <span className="block truncate text-[13px] font-semibold md:hidden">{DAY_NAMES[day].slice(0, 2)}</span>
              <span className="hidden truncate text-[13px] font-semibold md:block">{DAY_NAMES[day].slice(0, 3)}</span>
              <span className="block truncate font-mono text-[11px] tabular-nums text-text-muted md:hidden">{count}</span>
              <span className="hidden truncate font-mono text-[11px] tabular-nums text-text-muted md:block">{count} slots</span>
            </button>
          );
        })}
      </div>

      <div className={cn("mt-3 hidden gap-2 md:grid", columns)}>
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
              "relative h-[22rem] overflow-hidden rounded-xl border bg-aura-s2/40",
              selectedDay === day ? "border-accent-blue/40" : "border-aura-line",
            )}
          >
            {HOURS.map((hour) => (
              <div key={hour} className="absolute inset-x-0 border-t border-aura-line/60" style={{ top: percent(hour * 60) }} />
            ))}
            {rules
              .filter((rule) => rule.day_of_week === day && rule.is_active)
              .map((rule) => (
                <div
                  key={rule.id}
                  className="absolute inset-x-1 overflow-hidden rounded-lg border border-accent-blue/40 bg-accent-blue/25 px-1.5 py-1 font-mono text-[11px] tabular-nums text-text-primary"
                  style={{
                    top: percent(toMinutes(rule.start_time)),
                    height: `${((Math.min(toMinutes(rule.end_time), LAST_MINUTE) - Math.max(toMinutes(rule.start_time), FIRST_MINUTE)) / SPAN) * 100}%`,
                  }}
                >
                  {rule.start_time}–{rule.end_time}
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
