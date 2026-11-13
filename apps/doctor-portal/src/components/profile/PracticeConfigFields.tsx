import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { PRACTICE_SLOT_DURATIONS } from "@healthoraa/validation";
import type { UpdatePractitionerProfileInput } from "@healthoraa/validation";
import { ERROR_TEXT, INPUT, LABEL, cn } from "@healthoraa/ui";
import { LanguageChips } from "./LanguageChips";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {hint && <span className="font-mono text-[11px] text-text-muted">{hint}</span>}
      </div>
      {children}
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}

// Two-column grid for the four numeric and text settings, then languages and bio full width.
export function PracticeConfigFields({ form }: { form: UseFormReturn<UpdatePractitionerProfileInput> }) {
  const { register, formState, watch } = form;
  const { errors } = formState;
  const bio = watch("bio") ?? "";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field id="profile-qualification" label="Qualification" error={errors.qualification?.message}>
          <input
            id="profile-qualification"
            type="text"
            aria-invalid={Boolean(errors.qualification)}
            className={INPUT}
            {...register("qualification")}
          />
        </Field>

        <Field id="profile-fee" label="Consultation fee (INR)" error={errors.consultation_fee_inr?.message}>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm tabular-nums text-text-muted">
              ₹
            </span>
            <input
              id="profile-fee"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              aria-invalid={Boolean(errors.consultation_fee_inr)}
              className={cn(INPUT, "pl-8 font-mono tabular-nums")}
              {...register("consultation_fee_inr", { valueAsNumber: true })}
            />
          </div>
        </Field>

        <Field id="profile-slot" label="Slot duration" error={errors.slot_duration_minutes?.message}>
          <select
            id="profile-slot"
            aria-invalid={Boolean(errors.slot_duration_minutes)}
            className={INPUT}
            {...register("slot_duration_minutes", { setValueAs: (value: string) => Number(value) })}
          >
            {PRACTICE_SLOT_DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </Field>

        <Field id="profile-experience" label="Years of experience" error={errors.years_of_experience?.message}>
          <input
            id="profile-experience"
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            max={70}
            aria-invalid={Boolean(errors.years_of_experience)}
            className={cn(INPUT, "font-mono tabular-nums")}
            {...register("years_of_experience", { valueAsNumber: true })}
          />
        </Field>
      </div>

      <LanguageChips form={form} />

      <Field id="profile-bio" label="Bio" error={errors.bio?.message} hint={`${bio.length}/1000`}>
        <textarea
          id="profile-bio"
          rows={4}
          aria-invalid={Boolean(errors.bio)}
          className={cn(INPUT, "resize-y")}
          {...register("bio")}
        />
      </Field>
    </div>
  );
}
