import { z } from "zod";

// 24-hour HH:MM, matching the availability rule regex in the spec.
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// day_of_week follows JavaScript Date.getDay() and Postgres EXTRACT(DOW): 0 is Sunday, 6 is Saturday.
export const availabilityRuleSchema = z.object({
  day_of_week: z
    .number({ error: "Choose a day of the week." })
    .int("Day must be a whole number.")
    .min(0, "Day must be between 0 (Sunday) and 6 (Saturday).")
    .max(6, "Day must be between 0 (Sunday) and 6 (Saturday)."),
  start_time: z
    .string({ error: "Start time is required." })
    .regex(TIME_PATTERN, "Start time must be HH:MM in 24-hour format."),
  end_time: z
    .string({ error: "End time is required." })
    .regex(TIME_PATTERN, "End time must be HH:MM in 24-hour format."),
  is_active: z.boolean(),
});

export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// A single time window must end after it starts. Kept separate because refinements cannot be extended.
export const availabilityWindowSchema = availabilityRuleSchema.refine(
  (rule) => {
    const start = timeToMinutes(rule.start_time);
    const end = timeToMinutes(rule.end_time);
    return Number.isNaN(start) || Number.isNaN(end) || end > start;
  },
  { message: "End time must be after start time.", path: ["end_time"] },
);

export const SLOT_DURATION_OPTIONS = [30, 45] as const;

export const slotDurationSchema = z
  .number({ error: "Choose a slot length." })
  .refine((value) => (SLOT_DURATION_OPTIONS as readonly number[]).includes(value), {
    message: "Slot length must be 30 or 45 minutes.",
  });

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;
