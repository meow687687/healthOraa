import { Trash2 } from "lucide-react";
import { Badge, ERROR_TEXT, INPUT, PANEL, cn } from "@healthoraa/ui";
import type { WindowDraft } from "../../types/schedule";
import { DAY_NAMES } from "../../lib/scheduleGenerator";
import { ToggleSwitch } from "./ToggleSwitch";

const ADD_WINDOW_PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-aura-line2 bg-aura-s3 text-accent-blue hover:bg-aura-s2 text-xs font-semibold py-1.5 px-3 transition-colors";
const REMOVE_BUTTON =
  "shrink-0 rounded-full p-1.5 text-accent-red transition-colors hover:bg-accent-red/10";

export function DayCard({
  dayOfWeek,
  windows,
  durationMinutes,
  errorFor,
  onToggleDay,
  onAddWindow,
  onUpdate,
  onRemove,
}: {
  dayOfWeek: number;
  windows: WindowDraft[];
  durationMinutes: number;
  errorFor: (rule: WindowDraft) => string | null;
  onToggleDay: (next: boolean) => void;
  onAddWindow: () => void;
  onUpdate: (id: string, patch: Partial<Omit<WindowDraft, "id" | "day_of_week">>) => void;
  onRemove: (id: string) => void;
}) {
  const name = DAY_NAMES[dayOfWeek];
  const anyActive = windows.some((w) => w.is_active);

  return (
    <article aria-labelledby={`day-${dayOfWeek}`} className={cn(PANEL, "flex flex-col gap-4 p-5")}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 id={`day-${dayOfWeek}`} className="text-base font-semibold text-text-primary">
            {name}
          </h3>
          <div className="flex flex-wrap gap-2">
            <Badge tone={anyActive ? "emerald" : "neutral"}>{anyActive ? "Open" : "Closed"}</Badge>
            <Badge tone="blue">{durationMinutes} min intervals</Badge>
          </div>
        </div>
        <ToggleSwitch
          label={`${name} open for bookings`}
          checked={anyActive}
          disabled={windows.length === 0}
          onChange={onToggleDay}
        />
      </header>

      {windows.length === 0 ? (
        <p className="text-xs text-text-muted">No time windows. Patients cannot book on this day.</p>
      ) : (
        <ul className="space-y-3">
          {windows.map((window, index) => {
            const error = errorFor(window);
            return (
              <li key={window.id} className="space-y-1.5 rounded-2xl border border-aura-line bg-aura-s2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleSwitch
                    label={`${name} window ${index + 1} active`}
                    checked={window.is_active}
                    onChange={(next) => onUpdate(window.id, { is_active: next })}
                  />
                  <input
                    type="time"
                    aria-label={`${name} window ${index + 1} start`}
                    value={window.start_time}
                    onChange={(event) => onUpdate(window.id, { start_time: event.target.value })}
                    className={cn(INPUT, "w-auto min-w-[6.5rem] py-1.5 font-mono text-xs")}
                  />
                  <span className="text-xs text-text-muted">to</span>
                  <input
                    type="time"
                    aria-label={`${name} window ${index + 1} end`}
                    value={window.end_time}
                    onChange={(event) => onUpdate(window.id, { end_time: event.target.value })}
                    className={cn(INPUT, "w-auto min-w-[6.5rem] py-1.5 font-mono text-xs")}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(window.id)}
                    aria-label={`Remove ${name} window ${index + 1}`}
                    title="Remove window"
                    className={REMOVE_BUTTON}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {error && <p className={ERROR_TEXT}>{error}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button type="button" onClick={onAddWindow} className={ADD_WINDOW_PILL}>
          + Add Time Window
        </button>
      </div>
    </article>
  );
}
