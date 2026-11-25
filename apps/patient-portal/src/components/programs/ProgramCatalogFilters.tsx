import { Search, X } from "lucide-react";
import { PROGRAM_CATEGORY_VALUES } from "@healthoraa/validation";
import { PROGRAM_CATEGORY_LABELS } from "@healthoraa/types";
import type { ProgramCategory } from "@healthoraa/types";

export type ProgramCategoryFilter = ProgramCategory | "all";

export function ProgramCatalogFilters({
  search,
  category,
  onSearchChange,
  onCategoryChange,
}: {
  search: string;
  category: ProgramCategoryFilter;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: ProgramCategoryFilter) => void;
}) {
  return (
    <div className="space-y-4">
      <div role="search" className="relative">
        <label htmlFor="program-search" className="sr-only">
          Search programs
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          id="program-search"
          type="text"
          inputMode="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search programs"
          className="min-h-12 w-full rounded-2xl border border-aura-line bg-aura-s1 pl-11 pr-14 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/30"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Clear program search"
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-text-muted hover:bg-aura-s3 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by program category"
      >
        <CategoryButton
          active={category === "all"}
          label="All programs"
          onClick={() => onCategoryChange("all")}
        />
        {PROGRAM_CATEGORY_VALUES.map((value) => (
          <CategoryButton
            key={value}
            active={category === value}
            label={PROGRAM_CATEGORY_LABELS[value]}
            onClick={() => onCategoryChange(value)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue ${
        active
          ? "border-accent-blue bg-aura-s3 text-text-primary"
          : "border-aura-line bg-aura-s1 text-text-secondary hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
