import { EmptyState } from "@healthoraa/ui";
import { useState } from "react";
import { Apple, Plus, Power, Pencil, Trash2, Loader2 } from "lucide-react";
import type { NutritionProgram } from "@healthoraa/types";
import { useToggleProgramActive, usePrograms } from "../../hooks/usePrograms";
import CreateProgramDrawer from "./CreateProgramDrawer";
import { CATEGORY_META, formatInr } from "./programMeta";
import { Badge } from "../ui/Badge";
import { ActiveSwitch } from "../ui/Switch";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import { BTN_PRIMARY, ERROR_BOX, MONEY, NUM, PANEL, ROW_MICRO, TABLE_HEAD } from "../ui/tokens";
import { cn } from "../../lib/cn";

export default function ProgramsView() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: programs, isLoading, isError, error } = usePrograms();
  const toggleActive = useToggleProgramActive();

  const busyId = toggleActive.isPending ? toggleActive.variables?.id : undefined;

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Apple}
        tone="emerald"
        title="Nutrition Programs"
        subtitle={
          programs
            ? `${programs.length} program${programs.length === 1 ? "" : "s"} in catalog`
            : "Loading catalog..."
        }
        action={
          <button type="button" onClick={() => setIsDrawerOpen(true)} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" />
            Create Program
          </button>
        }
      />

      <div className={cn(PANEL, "overflow-hidden")}>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading programs...
          </div>
        )}

        {isError && <div className={cn(ERROR_BOX, "m-6")}>Could not load programs: {error.message}</div>}

        {!isLoading && !isError && programs?.length === 0 && (
          <EmptyState
            icon={Apple}
            title="No programs yet"
            description="Create the first program to publish it to the catalog."
            action={{ label: "Create Program", onClick: () => setIsDrawerOpen(true) }}
            className="border-0 bg-transparent shadow-none"
          />
        )}

        {!isLoading && !isError && programs && programs.length > 0 && (
          <div className="table-scroll overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Price</th>
                  <th className="px-6 py-4 font-medium">Active</th>
                  <th className="px-6 py-4 font-medium w-40" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {programs.map((program: NutritionProgram) => {
                  const isSelected = selectedId === program.id;
                  const busy = busyId === program.id;
                  const meta = CATEGORY_META[program.category];
                  return (
                    <tr
                      key={program.id}
                      onClick={() => setSelectedId(program.id)}
                      className={cn(
                        "group border-b border-aura-line last:border-0 transition-colors cursor-pointer",
                        isSelected ? "bg-aura-s2" : "hover:bg-aura-s2/60",
                      )}
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary">{program.title}</p>
                        {program.description && (
                          <p className="text-xs text-text-muted line-clamp-1 max-w-sm">{program.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className={cn("px-6 py-4", NUM)}>{program.duration_days} days</td>
                      <td className={cn("px-6 py-4", MONEY)}>{formatInr(program.price_inr)}</td>
                      <td className="px-6 py-4">
                        <ActiveSwitch
                          checked={program.is_active}
                          disabled={busy}
                          label={`Toggle ${program.title} active`}
                          onChange={(next) => toggleActive.mutate({ id: program.id, isActive: next })}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <RowActions active={isSelected}>
                          <button
                            type="button"
                            title={program.is_active ? "Deactivate" : "Activate"}
                            aria-label={program.is_active ? "Deactivate program" : "Activate program"}
                            onClick={() => toggleActive.mutate({ id: program.id, isActive: !program.is_active })}
                            disabled={busy}
                            className={ROW_MICRO}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Edit (coming soon)"
                            aria-label="Edit program"
                            className={ROW_MICRO}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Delete (coming soon)"
                            aria-label="Delete program"
                            className={ROW_MICRO}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {toggleActive.isError && (
              <p className="px-6 py-3 text-xs text-accent-red border-t border-aura-line">
                Could not update status: {toggleActive.error.message}
              </p>
            )}
          </div>
        )}
      </div>

      <CreateProgramDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
