import { useState } from "react";
import { History, Loader2, Power, ShieldCheck, Stethoscope, FileSearch } from "lucide-react";
import { usePractitioners, useTogglePractitionerActive } from "../../hooks/usePractitioners";
import type { PractitionerWithProfile } from "../../hooks/usePractitioners";
import { formatInr } from "../programs/programMeta";
import PractitionerAuditDrawer from "./PractitionerAuditDrawer";
import { Badge } from "../ui/Badge";
import { ActiveSwitch } from "../ui/Switch";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import { ERROR_BOX, MONEY, NUM, PANEL, ROW_MICRO, TABLE_HEAD } from "../ui/tokens";
import { cn } from "../../lib/cn";

type VerificationStatus = PractitionerWithProfile["verification_status"];

function StatusBadge({ isActive, verification }: { isActive: boolean; verification: VerificationStatus }) {
  if (verification === "pending") return <Badge tone="amber">Pending Review</Badge>;
  if (verification === "rejected") return <Badge tone="red">Rejected</Badge>;
  if (verification === "verified") return isActive ? <Badge tone="emerald">Verified</Badge> : <Badge tone="neutral">Inactive</Badge>;
  return isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="neutral">Inactive</Badge>;
}

export default function PractitionersView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const { data: practitioners, isLoading, isError, error } = usePractitioners();
  const toggleActive = useTogglePractitionerActive();

  const busyId = toggleActive.isPending ? toggleActive.variables?.id : undefined;
  const activeCount = practitioners?.filter((p) => p.is_active).length ?? 0;
  const auditTarget = practitioners?.find((p) => p.id === auditId) ?? null;

  const handleToggle = (row: PractitionerWithProfile) =>
    toggleActive.mutate({ id: row.id, isActive: !row.is_active });

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Stethoscope}
        tone="blue"
        title="Practitioners"
        subtitle={
          practitioners
            ? `${practitioners.length} registered · ${activeCount} active`
            : "Loading practitioners..."
        }
        action={
          <Badge tone="blue">
            <ShieldCheck className="w-3.5 h-3.5" />
            NMC / IDA Registry
          </Badge>
        }
      />

      <div className={cn(PANEL, "overflow-hidden")}>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading practitioners...
          </div>
        )}

        {isError && <div className={ERROR_BOX}>Could not load practitioners: {error.message}</div>}

        {!isLoading && !isError && practitioners?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-semibold text-text-primary">No practitioners registered</p>
            <p className="text-xs text-text-muted">Verified doctors and nutritionists will appear here.</p>
          </div>
        )}

        {!isLoading && !isError && practitioners && practitioners.length > 0 && (
          <div className="table-scroll overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="px-6 py-4 font-medium">Doctor Name</th>
                  <th className="px-6 py-4 font-medium">Registration No.</th>
                  <th className="px-6 py-4 font-medium">Qualification</th>
                  <th className="px-6 py-4 font-medium">Slot Fee</th>
                  <th className="px-6 py-4 font-medium">Slot Duration</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Active</th>
                  <th className="px-6 py-4 font-medium w-32" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {practitioners.map((row) => {
                  const isSelected = selectedId === row.id;
                  const busy = busyId === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        "group border-b border-aura-line last:border-0 transition-colors cursor-pointer",
                        isSelected ? "bg-aura-s2" : "hover:bg-aura-s2/60",
                      )}
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary">{row.profiles.full_name}</p>
                        <p className="text-xs text-text-muted font-mono">
                          {row.profiles.phone ?? "No phone on file"}
                        </p>
                      </td>
                      <td className={cn("px-6 py-4", NUM)}>{row.registration_number}</td>
                      <td className="px-6 py-4 text-text-secondary">{row.qualification}</td>
                      <td className={cn("px-6 py-4", MONEY)}>{formatInr(row.consultation_fee_inr)}</td>
                      <td className={cn("px-6 py-4", NUM)}>{row.slot_duration_minutes} mins</td>
                      <td className="px-6 py-4">
                        <StatusBadge isActive={row.is_active} verification={row.verification_status} />
                      </td>
                      <td className="px-6 py-4">
                        <ActiveSwitch
                          checked={row.is_active}
                          disabled={busy}
                          label={`Toggle ${row.profiles.full_name} active`}
                          onChange={() => handleToggle(row)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <RowActions active={isSelected}>
                          <button
                            type="button"
                            title="Open credential audit"
                            aria-label="Open credential audit"
                            onClick={() => setAuditId(row.id)}
                            className={ROW_MICRO}
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Audit log (coming soon)"
                            aria-label="Audit log"
                            className={ROW_MICRO}
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(row)}
                            disabled={busy}
                            title={row.is_active ? "Deactivate" : "Activate"}
                            aria-label={row.is_active ? "Deactivate practitioner" : "Activate practitioner"}
                            className={ROW_MICRO}
                          >
                            <Power className="w-3.5 h-3.5" />
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

      <PractitionerAuditDrawer practitioner={auditTarget} onClose={() => setAuditId(null)} />
    </div>
  );
}
