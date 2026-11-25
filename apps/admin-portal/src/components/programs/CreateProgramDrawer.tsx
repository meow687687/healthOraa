import { useState } from "react";
import type { FormEvent } from "react";
import type { InsertTables, NutritionProgram, ProgramCategory, UpdateTables } from "@healthoraa/types";
import { createProgramSchema } from "@healthoraa/validation";
import type { CreateProgramInput } from "@healthoraa/validation";
import { useCreateProgram, useUpdateProgram } from "../../hooks/usePrograms";
import { CATEGORY_META, PROGRAM_CATEGORIES } from "./programMeta";
import { Drawer, DrawerHeader } from "../ui/Drawer";
import { cn } from "../../lib/cn";
import {
  BTN_PRIMARY_BLOCK,
  BTN_SECONDARY_BLOCK,
  ERROR_BOX,
  ERROR_TEXT,
  INPUT,
  LABEL,
  TONE_TEXT,
} from "../ui/tokens";

interface CreateProgramDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  program?: NutritionProgram | null;
}

interface ProgramFormState {
  title: string;
  category: ProgramCategory;
  durationDays: string;
  priceInr: string;
  description: string;
  introVideoUrl: string;
}

type ProgramFormErrors = Partial<Record<keyof ProgramFormState, string>>;

const INITIAL_FORM: ProgramFormState = {
  title: "",
  category: "weight_management",
  durationDays: "60",
  priceInr: "",
  description: "",
  introVideoUrl: "",
};

const FORM_FIELD_BY_SCHEMA_KEY: Record<keyof CreateProgramInput, keyof ProgramFormState> = {
  title: "title",
  category: "category",
  duration_days: "durationDays",
  price_inr: "priceInr",
  description: "description",
  intro_video_url: "introVideoUrl",
};

const toSchemaInput = (form: ProgramFormState) => ({
  title: form.title,
  category: form.category,
  duration_days: form.durationDays.trim() === "" ? undefined : Number(form.durationDays),
  price_inr: form.priceInr.trim() === "" ? undefined : Number(form.priceInr),
  description: form.description,
  intro_video_url: form.introVideoUrl.trim() === "" ? undefined : form.introVideoUrl,
});

const validateForm = (
  form: ProgramFormState,
): { data: CreateProgramInput } | { errors: ProgramFormErrors } => {
  const result = createProgramSchema.safeParse(toSchemaInput(form));
  if (result.success) return { data: result.data };

  const errors: ProgramFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    const field = FORM_FIELD_BY_SCHEMA_KEY[key as keyof CreateProgramInput];
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { errors };
};

const toFormState = (program: NutritionProgram | null | undefined): ProgramFormState =>
  program
    ? {
        title: program.title,
        category: program.category,
        durationDays: String(program.duration_days),
        priceInr: String(program.price_inr),
        description: program.description ?? "",
        introVideoUrl: program.intro_video_url ?? "",
      }
    : INITIAL_FORM;

export default function CreateProgramDrawer({ isOpen, onClose, program }: CreateProgramDrawerProps) {
  const [form, setForm] = useState<ProgramFormState>(() => toFormState(program));
  const [errors, setErrors] = useState<ProgramFormErrors>({});
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const isSaving = createProgram.isPending || updateProgram.isPending;
  const mutationError = program ? updateProgram.error : createProgram.error;

  const update = <K extends keyof ProgramFormState>(key: K, value: ProgramFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    createProgram.reset();
    updateProgram.reset();
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateForm(form);
    if ("errors" in validation) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    const input = validation.data;
    const payload: InsertTables<"programs"> = {
      title: input.title,
      category: input.category,
      duration_days: input.duration_days,
      price_inr: input.price_inr,
      description: input.description || null,
      intro_video_url: input.intro_video_url || null,
    };

    if (program) {
      const changes: UpdateTables<"programs"> = payload;
      updateProgram.mutate({ id: program.id, changes }, { onSuccess: handleClose });
    } else {
      createProgram.mutate(payload, { onSuccess: handleClose });
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} labelledBy="program-form-title">
      <DrawerHeader
        eyebrow="Catalog"
        title={program ? "Edit Program" : "Create Program"}
        titleId="program-form-title"
        onClose={handleClose}
      >
        <p className="text-xs text-text-secondary">
          {program ? "Update the details shown in the customer catalog." : "Publish a new nutrition program to the customer catalog."}
        </p>
      </DrawerHeader>

      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 py-6">
          <div className="space-y-1.5">
            <label htmlFor="program-title" className={LABEL}>
              Title
            </label>
            <input
              id="program-title"
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. 60-Day PCOD Reset"
              className={INPUT}
            />
            {errors.title && <p className={ERROR_TEXT}>{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <span className={LABEL}>Category</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Category">
              {PROGRAM_CATEGORIES.map((category) => {
                const selected = form.category === category;
                const meta = CATEGORY_META[category];
                return (
                  <button
                    key={category}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update("category", category)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-semibold transition-all",
                      selected
                        ? "bg-aura-s3 border-accent-blue text-text-primary shadow-aura-elevated"
                        : "bg-aura-s2 border-aura-line text-text-secondary hover:text-text-primary",
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full bg-current", TONE_TEXT[meta.tone])} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="program-duration" className={LABEL}>
                Duration (days)
              </label>
              <input
                id="program-duration"
                type="number"
                min={1}
                step={1}
                value={form.durationDays}
                onChange={(e) => update("durationDays", e.target.value)}
                className={cn(INPUT, "font-mono")}
              />
              {errors.durationDays && <p className={ERROR_TEXT}>{errors.durationDays}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="program-price" className={LABEL}>
                Price (INR)
              </label>
              <input
                id="program-price"
                type="number"
                min={0}
                step="0.01"
                value={form.priceInr}
                onChange={(e) => update("priceInr", e.target.value)}
                placeholder="0.00"
                className={cn(INPUT, "font-mono")}
              />
              {errors.priceInr && <p className={ERROR_TEXT}>{errors.priceInr}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="program-description" className={LABEL}>
              Description
            </label>
            <textarea
              id="program-description"
              rows={5}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Enter the approved program description and inclusions."
              className={cn(INPUT, "resize-none")}
            />
            <p className="text-xs text-text-muted">
              Publish client-approved wording only. Keep medical outcomes and product claims out until reviewed.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="program-intro-video" className={LABEL}>
              Introduction video URL <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              id="program-intro-video"
              type="url"
              value={form.introVideoUrl}
              onChange={(e) => update("introVideoUrl", e.target.value)}
              placeholder="https://…"
              aria-invalid={Boolean(errors.introVideoUrl)}
              aria-describedby={
                errors.introVideoUrl
                  ? "program-intro-video-help program-intro-video-error"
                  : "program-intro-video-help"
              }
              className={INPUT}
            />
            <p id="program-intro-video-help" className="text-xs text-text-muted">
              Add a public, client-approved video. Patients open it on its hosting site.
            </p>
            {errors.introVideoUrl && (
              <p id="program-intro-video-error" className={ERROR_TEXT} role="alert">
                {errors.introVideoUrl}
              </p>
            )}
          </div>

          {mutationError && <div role="alert" className={ERROR_BOX}>{mutationError.message}</div>}
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-aura-line">
          <button type="submit" disabled={isSaving} className={BTN_PRIMARY_BLOCK}>
            {isSaving ? "Saving..." : program ? "Save Changes" : "Create Program"}
          </button>
          <button type="button" onClick={handleClose} className={BTN_SECONDARY_BLOCK}>
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  );
}
