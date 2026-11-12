import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ERROR_TEXT, INPUT, LABEL } from "@healthoraa/ui";

// Free-text list (allergies, medications). Entries are added with Enter or the Add button.
export function TagInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const entry = draft.trim();
    setDraft("");
    if (!entry || value.includes(entry)) return;
    onChange([...value, entry]);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className={INPUT}
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-aura-line2 bg-aura-s3 px-4 text-xs font-semibold text-text-primary hover:bg-aura-s2"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((entry) => (
            <li
              key={entry}
              className="inline-flex items-center gap-1.5 rounded-full border border-aura-line2 bg-aura-s2 py-1 pl-3 pr-1 text-xs text-text-primary"
            >
              {entry}
              <button
                type="button"
                aria-label={`Remove ${entry}`}
                onClick={() => onChange(value.filter((item) => item !== entry))}
                className="rounded-full p-1 text-text-muted hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={ERROR_TEXT}>{error}</p>}
    </div>
  );
}
