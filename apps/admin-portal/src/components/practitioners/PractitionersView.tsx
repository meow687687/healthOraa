import { useState } from "react";
import { ShieldCheck, Stethoscope } from "lucide-react";
import type { PractitionerWithProfile } from "../../hooks/usePractitioners";
import {
  usePractitioners,
  useTogglePractitionerActive,
} from "../../hooks/usePractitioners";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/Badge";
import { ViewHeader } from "../ui/ViewHeader";
import { ERROR_BOX, PANEL } from "../ui/tokens";
import PractitionerAuditDrawer from "./PractitionerAuditDrawer";
import {
  PractitionerDataTable,
  type PractitionerFilterId,
} from "./PractitionerDataTable";

export default function PractitionersView() {
  const [filter, setFilter] = useState<PractitionerFilterId>("all");
  const [auditId, setAuditId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = usePractitioners();
  const toggleActive = useTogglePractitionerActive();
  const practitioners = data ?? [];
  const busyId = toggleActive.isPending
    ? toggleActive.variables?.id
    : undefined;
  const activeCount = practitioners.filter((row) => row.is_active).length;
  const auditTarget = practitioners.find((row) => row.id === auditId) ?? null;

  const handleToggle = (row: PractitionerWithProfile): void => {
    toggleActive.mutate({ id: row.id, isActive: !row.is_active });
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Stethoscope}
        tone="blue"
        title="Practitioners"
        subtitle={
          data
            ? `${data.length} registered · ${activeCount} active`
            : "Loading practitioners..."
        }
        action={
          <Badge tone="blue">
            <ShieldCheck className="h-3.5 w-3.5" />
            NMC / IDA Registry
          </Badge>
        }
      />

      {isError && (
        <div className={ERROR_BOX}>
          Could not load practitioners: {error.message}
        </div>
      )}

      {!isError && (
        <div className={cn(PANEL, "overflow-hidden")}>
          <PractitionerDataTable
            rows={practitioners}
            filter={filter}
            onFilterChange={setFilter}
            onAudit={setAuditId}
            isLoading={isLoading}
            busyId={busyId}
            onToggleActive={handleToggle}
          />
          {toggleActive.isError && (
            <p className="border-t border-aura-line px-6 py-3 text-xs text-accent-red">
              Could not update status: {toggleActive.error.message}
            </p>
          )}
        </div>
      )}

      <PractitionerAuditDrawer
        practitioner={auditTarget}
        onClose={() => setAuditId(null)}
      />
    </div>
  );
}
