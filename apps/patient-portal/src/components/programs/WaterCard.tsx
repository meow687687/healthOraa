import { Plus } from "lucide-react";
import { BTN_PRIMARY, LABEL, PANEL, cn } from "@healthoraa/ui";
import { WATER_GOAL_ML, WATER_STEP_ML } from "../../lib/meals";

export function WaterCard({ waterMl, onAdd }: { waterMl: number; onAdd: () => void }) {
  const percent = Math.min(Math.round((waterMl / WATER_GOAL_ML) * 100), 100);

  return (
    <section aria-labelledby="water-title" className={cn(PANEL, "space-y-5")}>
      <div>
        <p className={LABEL}>Hydration</p>
        <h3 id="water-title" className="mt-1 text-sm font-semibold text-text-primary">
          Water intake today
        </h3>
      </div>

      <div className="space-y-1">
        <p className="font-mono text-3xl font-bold tabular-nums text-white">
          {waterMl.toLocaleString("en-IN")} <span className="text-sm font-medium text-text-muted">ml</span>
        </p>
        <p className="text-xs text-text-muted">
          {percent}% of the {WATER_GOAL_ML.toLocaleString("en-IN")} ml goal
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Water intake against goal"
        aria-valuemin={0}
        aria-valuemax={WATER_GOAL_ML}
        aria-valuenow={Math.min(waterMl, WATER_GOAL_ML)}
        className="h-2 overflow-hidden rounded-full bg-aura-s3"
      >
        <div className="h-full rounded-full bg-accent-blue transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      <button type="button" onClick={onAdd} className={cn(BTN_PRIMARY, "w-full")}>
        <Plus className="h-4 w-4" />
        Add {WATER_STEP_ML} ml
      </button>
    </section>
  );
}
