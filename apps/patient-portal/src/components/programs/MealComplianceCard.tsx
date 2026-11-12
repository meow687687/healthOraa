import { Badge, LABEL, PANEL, cn } from "@healthoraa/ui";
import { MEALS } from "../../lib/meals";
import type { MealId } from "../../types/program";

export function MealComplianceCard({ meals, onToggle }: { meals: MealId[]; onToggle: (meal: MealId) => void }) {
  const onPlan = MEALS.filter((meal) => meals.includes(meal.id)).length;

  return (
    <section aria-labelledby="meals-title" className={cn(PANEL, "space-y-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={LABEL}>Today&apos;s plan</p>
          <h3 id="meals-title" className="mt-1 text-sm font-semibold text-text-primary">
            Meal compliance
          </h3>
        </div>
        <Badge tone={onPlan === MEALS.length ? "emerald" : "neutral"}>
          {onPlan} of {MEALS.length} on plan
        </Badge>
      </div>

      <ul className="space-y-2">
        {MEALS.map((meal) => {
          const on = meals.includes(meal.id);
          return (
            <li key={meal.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onToggle(meal.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-aura-line bg-aura-s2 px-4 py-3 text-left transition-colors hover:bg-aura-s3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-primary">{meal.label}</span>
                  <span className="font-mono text-[11px] text-text-muted">{meal.time}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-accent-emerald" : "bg-aura-s3")}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                      on ? "left-[1.1rem]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
