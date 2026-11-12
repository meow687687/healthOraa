import { useFieldArray } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { CreatePrescriptionFormValues } from "@healthoraa/validation";
import { ERROR_TEXT, INPUT, LABEL } from "@healthoraa/ui";
import { EMPTY_MEDICINE, FREQUENCY_OPTIONS } from "../../lib/prescriptionOptions";

const ADD_BUTTON =
  "inline-flex items-center gap-1.5 rounded-full border border-aura-line2 bg-aura-s3 text-accent-blue hover:bg-aura-s2 text-xs font-semibold py-1.5 px-3 transition-colors";
const REMOVE_BUTTON =
  "text-accent-red hover:bg-accent-red/10 p-1.5 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}

export function MedicineItemizer({
  control,
  register,
  errors,
}: {
  control: Control<CreatePrescriptionFormValues>;
  register: UseFormRegister<CreatePrescriptionFormValues>;
  errors: FieldErrors<CreatePrescriptionFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "medicines" });
  const listError = errors.medicines?.root?.message;

  return (
    <section aria-labelledby="rx-medicines-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="rx-medicines-heading" className={LABEL}>
          Medications ({fields.length})
        </h3>
        <button type="button" onClick={() => append({ ...EMPTY_MEDICINE })} className={ADD_BUTTON}>
          <Plus className="h-3.5 w-3.5" />
          Add Medication
        </button>
      </div>

      {fields.map((field, index) => {
        const rowErrors = errors.medicines?.[index];
        const id = `rx-med-${index}`;
        return (
          <div key={field.id} className="space-y-3 rounded-2xl border border-aura-line bg-aura-s2 p-4">
            <div className="flex items-center justify-between">
              <span className={LABEL}>Rx {index + 1}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                aria-label={`Remove medication ${index + 1}`}
                title="Remove medication"
                className={REMOVE_BUTTON}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id={`${id}-name`} label="Drug name" error={rowErrors?.name?.message}>
                  <input
                    id={`${id}-name`}
                    type="text"
                    placeholder="e.g. Metformin 500mg"
                    className={INPUT}
                    {...register(`medicines.${index}.name`)}
                  />
                </Field>
              </div>
              <Field id={`${id}-dosage`} label="Dosage" error={rowErrors?.dosage?.message}>
                <input
                  id={`${id}-dosage`}
                  type="text"
                  placeholder="e.g. 1 tablet"
                  className={INPUT}
                  {...register(`medicines.${index}.dosage`)}
                />
              </Field>
              <Field id={`${id}-frequency`} label="Frequency" error={rowErrors?.frequency?.message}>
                <select id={`${id}-frequency`} className={INPUT} {...register(`medicines.${index}.frequency`)}>
                  <option value="">Select frequency</option>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={`${id}-duration`} label="Duration (days)" error={rowErrors?.duration_days?.message}>
                <input
                  id={`${id}-duration`}
                  type="number"
                  min={1}
                  max={180}
                  step={1}
                  className={`${INPUT} font-mono`}
                  {...register(`medicines.${index}.duration_days`, { valueAsNumber: true })}
                />
              </Field>
              <Field id={`${id}-instructions`} label="Instructions (optional)" error={rowErrors?.instructions?.message}>
                <input
                  id={`${id}-instructions`}
                  type="text"
                  placeholder="e.g. Apply after moisturizer"
                  className={INPUT}
                  {...register(`medicines.${index}.instructions`)}
                />
              </Field>
            </div>
          </div>
        );
      })}

      {listError && (
        <p role="alert" className={ERROR_TEXT}>
          {listError}
        </p>
      )}
    </section>
  );
}
