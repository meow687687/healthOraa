import { DataTable, EmptyState, type DataColumn, type DataFilter } from "@healthoraa/ui";
import { useMemo, useState } from "react";
import { FileSearch, ShieldCheck, Stethoscope } from "lucide-react";
import { usePractitioners, useTogglePractitionerActive } from "../../hooks/usePractitioners";
import type { PractitionerWithProfile } from "../../hooks/usePractitioners";
import { formatInr } from "../programs/programMeta";
import PractitionerAuditDrawer from "./PractitionerAuditDrawer";
import { Badge } from "../ui/Badge";
import { ActiveSwitch } from "../ui/Switch";
import { ViewHeader } from "../ui/ViewHeader";
import { ERROR_BOX, MONEY, NUM, PANEL, ROW_MICRO } from "../ui/tokens";
import { cn } from "../../lib/cn";

type VerificationStatus = PractitionerWithProfile["verification_status"];
type FilterId = "all" | "pending" | "verified" | "inactive";

function StatusBadge({ isActive, verification }: { isActive: boolean; verification: VerificationStatus }) {
  if (verification === "pending") return <Badge tone="amber">Pending Review</Badge>;
  if (verification === "rejected") return <Badge tone="red">Rejected</Badge>;
  if (verification === "verified") return isActive ? <Badge tone="emerald">Verified</Badge> : <Badge tone="neutral">Inactive</Badge>;
  return isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="neutral">Inactive</Badge>;
}

const matchesFilter = (row: PractitionerWithProfile, id: string): boolean => {
  if (id === "all") return true;
  if (id === "pending") return row.verification_status === "pending";
  if (id === "verified") return row.verification_status === "verified";
  return !row.is_active;
};

export default function PractitionersView() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [auditId, setAuditId] = useState<string | null>(null);
  const { data: practitioners, isLoading, isError, error } = usePractitioners();
  const toggleActive = useTogglePractitionerActive();

  const busyId = toggleActive.isPending ? toggleActive.variables?.id : undefined;
  const activeCount = practitioners?.filter((p) => p.is_active).length ?? 0;
  const auditTarget = practitioners?.find((p) => p.id === auditId) ?? null;

  const counts = useMemo(() => {
    const rows = practitioners ?? [];
    return {
      all: rows.length,
      pending: rows.filter((r) => matchesFilter(r, "pending")).length,
      verified: rows.filter((r) => matchesFilter(r, "verified")).length,
      inactive: rows.filter((r) => matchesFilter(r, "inactive")).length,
    };
  }, [practitioners]);

  const handleToggle = (row: PractitionerWithProfile) =>
    toggleActive.mutate({ id: row.id, isActive: !row.is_active });

  const columns: DataColumn<PractitionerWithProfile>[] = [
    {
      id: "name",
      header: "Doctor",
      cell: (row) => (
        <div>
          <p className="font-semibold text-text-primary">{row.profiles.full_name}</p>
          <p className="text-xs text-text-muted font-mono">{row.profiles.phone ?? "No phone on file"}</p>
        </div>
      ),
      sortValue: (row) => row.profiles.full_name,
    },
    {
      id: "registration",
      header: "Registration",
      cell: (row) => <span className={NUM}>{row.registration_number}</span>,
      sortValue: (row) => row.registration_number,
      priority: "secondary",
    },
    {
      id: "qualification",
      header: "Qualification",
      cell: (row) => <span className="text-text-secondary">{row.qualification}</span>,
      sortValue: (row) => row.qualification,
      priority: "secondary",
    },
    {
      id: "fee",
      header: "Fee",
      align: "right",
      cell: (row) => <span className={MONEY}>{formatInr(row.consultation_fee_inr)}</span>,
      sortValue: (row) => row.consultation_fee_inr,
      priority: "secondary",
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge isActive={row.is_active} verification={row.verification_status} />,
      sortValue: (row) => row.verification_status,
    },
    {
      id: "active",
      header: "Accepting patients",
      cell: (row) => (
        <div onClick={(event) => event.stopPropagation()}>
          <ActiveSwitch
            checked={row.is_active}
            disabled={busyId === row.id}
            label={`Toggle ${row.profiles.full_name} active`}
            onChange={() => handleToggle(row)}
          />
        </div>
      ),
    },
    {
      id: "audit",
      header: "",
      align: "right",
      cell: (row) => (
        <button
          type="button"
          title="Open credential audit"
          aria-label={`Open credential audit for ${row.profiles.full_name}`}
          onClick={(event) => {
            event.stopPropagation();
            setAuditId(row.id);
          }}
          className={ROW_MICRO}
        >
          <FileSearch className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  const statusFilter: DataFilter<PractitionerWithProfile> = {
    active: filter,
    options: [
      { id: "all", label: `All ${counts.all}` },
      { id: "pending", label: `Pending review ${counts.pending}` },
      { id: "verified", label: `Verified ${counts.verified}` },
      { id: "inactive", label: `Inactive ${counts.inactive}` },
    ],
    onChange: (id) => setFilter(id as FilterId),
    match: matchesFilter,
  };

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

      {isError && <div className={ERROR_BOX}>Could not load practitioners: {error.message}</div>}

      {!isError && (
        <div className={cn(PANEL, "overflow-hidden")}>
          <DataTable
            caption="Practitioners"
            rows={practitioners ?? []}
            columns={columns}
            getRowId={(row) => row.id}
            searchText={(row) => `${row.profiles.full_name} ${row.registration_number} ${row.qualification}`}
            searchPlaceholder="Search name, registration or qualification"
            filter={statusFilter}
            onRowClick={(row) => setAuditId(row.id)}
            isLoading={isLoading}
            emptyState={
              <EmptyState
                icon={Stethoscope}
                title="No practitioners registered"
                description="Verified doctors and nutritionists will appear here."
              />
            }
          />
          {toggleActive.isError && (
            <p className="px-6 py-3 text-xs text-accent-red border-t border-aura-line">
              Could not update status: {toggleActive.error.message}
            </p>
          )}
        </div>
      )}

      <PractitionerAuditDrawer practitioner={auditTarget} onClose={() => setAuditId(null)} />
    </div>
  );
}
