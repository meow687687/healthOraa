import { useState } from "react";
import type { FormEvent } from "react";
import type { InsertTables, ProgramCategory } from "@healthoraa/types";
import { createProgramSchema } from "@healthoraa/validation";
import type { CreateProgramInput } from "@healthoraa/validation";
import { useCreateProgram } from "../../hooks/usePrograms";
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
}

interface ProgramFormState {
  title: string;
  category: ProgramCategory;
  durationDays: string;
  priceInr: string;
  description: string;
}

type ProgramFormErrors = Partial<Record<keyof ProgramFormState, string>>;

const INITIAL_FORM: ProgramFormState = {
  title: "",
  category: "weight_management",
  durationDays: "60",
  priceInr: "",
  description: "",
};

const FORM_FIELD_BY_SCHEMA_KEY: Record<keyof CreateProgramInput, keyof ProgramFormState> = {
  title: "title",
  category: "category",
  duration_days: "durationDays",
  price_inr: "priceInr",
  description: "description",
};

const toSchemaInput = (form: ProgramFormState): Record<keyof CreateProgramInput, unknown> => ({
  title: form.title,
  category: form.category,
  duration_days: form.durationDays.trim() === "" ? undefined : Number(form.durationDays),
  price_inr: form.priceInr.trim() === "" ? undefined : Number(form.priceInr),
  description: form.description,
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

export default function CreateProgramDrawer({ isOpen, onClose }: CreateProgramDrawerProps) {
  const [form, setForm] = useState<ProgramFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<ProgramFormErrors>({});
  const createProgram = useCreateProgram();

  const update = <K extends keyof ProgramFormState>(key: K, value: ProgramFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    createProgram.reset();
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
    };

    createProgram.mutate(payload, { onSuccess: handleClose });
  };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} labelledBy="create-program-title">
      <DrawerHeader
        eyebrow="Catalog"
        title="Create Program"
        titleId="create-program-title"
        onClose={handleClose}
      >
        <p className="text-xs text-text-secondary">Publish a new nutrition program to the mobile catalog.</p>
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
              placeholder="Target outcomes, inclusions and who this plan is for."
              className={cn(INPUT, "resize-none")}
            />
          </div>

          {createProgram.isError && <div className={ERROR_BOX}>{createProgram.error.message}</div>}
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-aura-line">
          <button type="submit" disabled={createProgram.isPending} className={BTN_PRIMARY_BLOCK}>
            {createProgram.isPending ? "Creating..." : "Create Program"}
          </button>
          <button type="button" onClick={handleClose} className={BTN_SECONDARY_BLOCK}>
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  );
}
