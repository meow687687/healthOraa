import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { ERROR_BOX, EmptyState, LABEL } from "@healthoraa/ui";
import { useProgramCatalog } from "../../hooks/useProgramCatalog";
import { ProgramCard } from "./ProgramCard";
import {
  ProgramCatalogFilters,
  type ProgramCategoryFilter,
} from "./ProgramCatalogFilters";
import { ProgramDetail } from "./ProgramDetail";

export default function ProgramCatalogView() {
  const query = useProgramCatalog();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProgramCategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const programs = query.data ?? [];
  const selected = programs.find((program) => program.id === selectedId);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return programs.filter((program) => {
      const matchesCategory =
        category === "all" || program.category === category;
      const matchesSearch =
        needle.length === 0 ||
        `${program.title} ${program.description ?? ""}`
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [category, programs, search]);

  if (selected)
    return (
      <ProgramDetail program={selected} onBack={() => setSelectedId(null)} />
    );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={LABEL}>Nutrition programs</p>
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Find a program
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          Review the available program outlines and introductions. A clinician
          can help you decide what is appropriate for you.
        </p>
      </header>

      {query.isError && (
        <div className={ERROR_BOX} role="alert">
          <p>Programs could not be loaded.</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 min-h-11 rounded-xl px-3 text-sm font-semibold text-text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
          >
            Try again
          </button>
        </div>
      )}

      <ProgramCatalogFilters
        search={search}
        category={category}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
      />

      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="Loading programs"
          className="grid gap-4 sm:grid-cols-2"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-60 animate-pulse rounded-3xl border border-aura-line bg-aura-s1"
            />
          ))}
        </div>
      ) : query.isError && programs.length === 0 ? null : programs.length ===
        0 ? (
        <EmptyState
          icon={BookOpen}
          title="No programs are available yet"
          description="Programs will appear here after the clinic publishes them."
          action={{
            label: "Refresh programs",
            onClick: () => void query.refetch(),
          }}
        />
      ) : filtered.length === 0 && !query.isError ? (
        <EmptyState
          icon={BookOpen}
          title="No matching programs"
          description="Try another search or category."
          action={{
            label: "Clear filters",
            onClick: () => {
              setSearch("");
              setCategory("all");
            },
          }}
        />
      ) : (
        <section
          aria-label="Available nutrition programs"
          className="grid gap-4 sm:grid-cols-2"
        >
          {filtered.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onSelect={() => setSelectedId(program.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
