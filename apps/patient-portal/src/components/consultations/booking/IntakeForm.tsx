import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientIntakeSchema } from "@healthoraa/validation";
import type { PatientIntakeInput } from "@healthoraa/validation";
import { BTN_PRIMARY, ERROR_TEXT, INPUT, LABEL, cn } from "@healthoraa/ui";
import { TagInput } from "./TagInput";

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

const Field = ({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className={LABEL}>
      {label}
    </label>
    {children}
    {error && <p className={ERROR_TEXT}>{error}</p>}
  </div>
);

export function IntakeForm({
  initial,
  onBack,
  onSubmit,
}: {
  initial: PatientIntakeInput | null;
  onBack: () => void;
  onSubmit: (values: PatientIntakeInput) => void;
}) {
  const { register, control, handleSubmit, watch, formState } = useForm<PatientIntakeInput>({
    resolver: zodResolver(patientIntakeSchema),
    mode: "onTouched",
    defaultValues: initial ?? {
      age: Number.NaN,
      chief_complaint: "",
      symptoms_duration: "",
      known_allergies: [],
      current_medications: [],
    },
  });
  const { errors } = formState;
  const complaint = watch("chief_complaint") ?? "";

  return (
    <form id="booking-intake" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <p className="text-sm text-text-secondary">
        Your doctor reads this before the call. Nothing is shared outside your care team.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <Field id="intake-age" label="Age" error={errors.age?.message}>
          <input
            id="intake-age"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            aria-invalid={Boolean(errors.age)}
            className={cn(INPUT, "font-mono tabular-nums")}
            {...register("age", { valueAsNumber: true })}
          />
        </Field>

        <Field id="intake-gender" label="Gender" error={errors.gender?.message}>
          <select id="intake-gender" aria-invalid={Boolean(errors.gender)} className={INPUT} {...register("gender")}>
            <option value="">Select an option</option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="intake-complaint" label={`Main concern (${complaint.length}/1000)`} error={errors.chief_complaint?.message}>
        <textarea
          id="intake-complaint"
          rows={4}
          placeholder="Describe what you are experiencing, when it started, and what you have noticed"
          aria-invalid={Boolean(errors.chief_complaint)}
          className={cn(INPUT, "resize-y")}
          {...register("chief_complaint")}
        />
      </Field>

      <Field id="intake-duration" label="How long have you had this?" error={errors.symptoms_duration?.message}>
        <input
          id="intake-duration"
          type="text"
          placeholder="For example: 3 months"
          aria-invalid={Boolean(errors.symptoms_duration)}
          className={INPUT}
          {...register("symptoms_duration")}
        />
      </Field>

      <Controller
        control={control}
        name="known_allergies"
        render={({ field, fieldState }) => (
          <TagInput
            id="intake-allergies"
            label="Known allergies (optional)"
            placeholder="For example: penicillin"
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="current_medications"
        render={({ field, fieldState }) => (
          <TagInput
            id="intake-medications"
            label="Current medications (optional)"
            placeholder="For example: metformin 500mg"
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <div className="flex items-center justify-between gap-3 border-t border-aura-line pt-5">
        <button type="button" onClick={onBack} className="rounded-full px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary">
          Back
        </button>
        <button type="submit" className={BTN_PRIMARY}>
          Continue to summary
        </button>
      </div>
    </form>
  );
}
