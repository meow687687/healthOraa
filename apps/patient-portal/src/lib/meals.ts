import type { MealId } from "../types/program";

export const MEALS: { id: MealId; label: string; time: string }[] = [
  { id: "breakfast", label: "Breakfast", time: "08:00" },
  { id: "lunch", label: "Lunch", time: "13:00" },
  { id: "snack", label: "Evening snack", time: "17:00" },
  { id: "dinner", label: "Dinner", time: "20:00" },
];

export const WATER_GOAL_ML = 2500;
export const WATER_STEP_ML = 250;
// shortcut: a hard cap for the quick-add button, not a clinical limit. Revisit when the programme sets a maximum.
export const WATER_MAX_ML = 6000;
