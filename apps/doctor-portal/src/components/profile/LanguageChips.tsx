import { Controller } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import type { UpdatePractitionerProfileInput } from "@healthoraa/validation";
import { ERROR_TEXT, LABEL, cn } from "@healthoraa/ui";

export const LANGUAGE_OPTIONS = ["English", "Hindi", "Assamese", "Bengali"] as const;

// Multi-select chips. Keeps any saved language visible even when it is not in the preset list.
export function LanguageChips({ form }: { form: UseFormReturn<UpdatePractitionerProfileInput> }) {
  return (
    <Controller
      control={form.control}
      name="languages_spoken"
      render={({ field, fieldState }) => {
        const selected = field.value ?? [];
        const extras = selected.filter((language) => !(LANGUAGE_OPTIONS as readonly string[]).includes(language));
        const options = [...LANGUAGE_OPTIONS, ...extras];

        const toggle = (language: string) => {
          field.onChange(
            selected.includes(language) ? selected.filter((item) => item !== language) : [...selected, language],
          );
        };

        return (
          <div role="group" aria-labelledby="languages-label" className="space-y-2">
            <p id="languages-label" className={LABEL}>
              Languages spoken
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((language) => {
                const on = selected.includes(language);
                return (
                  <button
                    key={language}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(language)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20",
                      on
                        ? "border-accent-blue/40 bg-accent-blue/15 text-accent-blue"
                        : "border-aura-line2 bg-aura-s2 text-text-secondary hover:text-text-primary",
                    )}
                  >
                    {language}
                  </button>
                );
              })}
            </div>
            {fieldState.error && <p className={ERROR_TEXT}>{fieldState.error.message}</p>}
          </div>
        );
      }}
    />
  );
}
