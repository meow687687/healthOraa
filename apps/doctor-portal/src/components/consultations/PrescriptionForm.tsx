import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPrescriptionSchema } from "@healthoraa/validation";
import type { CreatePrescriptionFormValues, CreatePrescriptionInput } from "@healthoraa/validation";
import { BTN_TEXT, ERROR_BOX, ERROR_TEXT, INPUT, LABEL } from "@healthoraa/ui";
import { useSavePrescription } from "../../hooks/usePrescriptions";
import type { QueueConsultation } from "../../types/queue";
import { MedicineItemizer } from "./MedicineItemizer";
import { FollowUpPicker } from "./FollowUpPicker";

export function PrescriptionForm({
  consultation,
  initialValues,
  onCancel,
  onSigned,
}: {
  consultation: QueueConsultation;
  initialValues: CreatePrescriptionInput;
  onCancel: () => void;
  onSigned: () => void;
}) {
  const save = useSavePrescription();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, submitCount },
  } = useForm<CreatePrescriptionFormValues, unknown, CreatePrescriptionInput>({
    resolver: zodResolver(createPrescriptionSchema),
    defaultValues: initialValues,
  });

  const followupDays = watch("followup_days");
  const invalidCount = Object.keys(errors).length;

  const onValid = (values: CreatePrescriptionInput) => {
    save.mutate({ consultation, values }, { onSuccess: onSigned });
  };

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="flex flex-1 flex-col">
      <div className="flex-1 space-y-6 py-6">
        {submitCount > 0 && invalidCount > 0 && (
          <div role="alert" className={ERROR_BOX}>
            Fix the highlighted fields before signing.
          </div>
        )}

        <section aria-labelledby="rx-diagnosis-heading" className="space-y-4">
          <h3 id="rx-diagnosis-heading" className={LABEL}>
            Diagnosis &amp; Notes
          </h3>
          <div className="space-y-1.5">
            <label htmlFor="rx-diagnosis" className={LABEL}>
              Diagnosis
            </label>
            <input
              id="rx-diagnosis"
              type="text"
              placeholder="e.g. Acne Vulgaris Grade II with Insulin Resistance"
              aria-invalid={errors.diagnosis ? true : undefined}
              className={INPUT}
              {...register("diagnosis")}
            />
            {errors.diagnosis && <p className={ERROR_TEXT}>{errors.diagnosis.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="rx-notes" className={LABEL}>
              Clinical notes (optional)
            </label>
            <textarea
              id="rx-notes"
              rows={3}
              placeholder="Examination findings, counselling given, lifestyle advice."
              className={`${INPUT} resize-none`}
              {...register("clinical_notes")}
            />
            {errors.clinical_notes && <p className={ERROR_TEXT}>{errors.clinical_notes.message}</p>}
          </div>
        </section>

        <MedicineItemizer control={control} register={register} errors={errors} />

        <FollowUpPicker
          value={followupDays ?? 7}
          error={errors.followup_days?.message}
          onChange={(days) => setValue("followup_days", days, { shouldValidate: true, shouldDirty: true })}
        />

        {save.isError && <div className={ERROR_BOX}>{save.error.message}</div>}
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-aura-line pt-6">
        <button type="button" onClick={onCancel} className={BTN_TEXT}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-full bg-accent-blue px-6 py-2.5 font-semibold text-white shadow-aura-elevated transition-all hover:bg-accent-blue/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {save.isPending ? "Signing..." : "Issue & Sign Rx"}
        </button>
      </footer>
    </form>
  );
}
