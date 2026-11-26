import {
  DataTable,
  EmptyState,
  type DataColumn,
  type DataFilter,
} from "@healthoraa/ui";
import { FileSearch, Stethoscope } from "lucide-react";
import type { PractitionerWithProfile } from "../../hooks/usePractitioners";
import { isSeededDemoPractitioner } from "../../lib/practitioners";
import { formatInr } from "../programs/programMeta";
import { Badge } from "../ui/Badge";
import { ActiveSwitch } from "../ui/Switch";
import { MONEY, NUM, ROW_MICRO } from "../ui/tokens";

export type PractitionerFilterId =
  "all" | "pending" | "verified" | "inactive" | "demo";

interface PractitionerDataTableProps {
  rows: PractitionerWithProfile[];
  filter: PractitionerFilterId;
  onFilterChange: (filter: PractitionerFilterId) => void;
  onAudit: (id: string) => void;
  isLoading: boolean;
  busyId: string | undefined;
  onToggleActive: (row: PractitionerWithProfile) => void;
}

type VerificationStatus = PractitionerWithProfile["verification_status"];

function StatusBadge({
  isActive,
  verification,
  isDemoRecord,
}: {
  isActive: boolean;
  verification: VerificationStatus;
  isDemoRecord: boolean;
}) {
  if (isDemoRecord) return <Badge tone="violet">Demo · not audited</Badge>;
  if (verification === "pending")
    return <Badge tone="amber">Pending Review</Badge>;
  if (verification === "rejected") return <Badge tone="red">Rejected</Badge>;
  if (verification === "verified")
    return isActive ? (
      <Badge tone="emerald">Verified</Badge>
    ) : (
      <Badge tone="neutral">Inactive</Badge>
    );
  return isActive ? (
    <Badge tone="emerald">Active</Badge>
  ) : (
    <Badge tone="neutral">Inactive</Badge>
  );
}

function matchesFilter(row: PractitionerWithProfile, id: string): boolean {
  if (id === "all") return true;
  const isDemoRecord = isSeededDemoPractitioner(row.id);
  if (id === "demo") return isDemoRecord;
  if (isDemoRecord) return false;
  if (id === "pending") return row.verification_status === "pending";
  if (id === "verified") {
    return row.verification_status === "verified";
  }
  return !row.is_active;
}

export function PractitionerDataTable({
  rows,
  filter,
  onFilterChange,
  onAudit,
  isLoading,
  busyId,
  onToggleActive,
}: PractitionerDataTableProps) {
  const columns: DataColumn<PractitionerWithProfile>[] = [
    {
      id: "name",
      header: "Doctor",
      cell: (row) => (
        <div>
          <p className="font-semibold text-text-primary">
            {row.profiles.full_name}
          </p>
          <p className="font-mono text-xs text-text-muted">
            {row.profiles.phone ?? "No phone on file"}
          </p>
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
      cell: (row) => (
        <span className="text-text-secondary">{row.qualification}</span>
      ),
      sortValue: (row) => row.qualification,
      priority: "secondary",
    },
    {
      id: "fee",
      header: "Fee",
      align: "right",
      cell: (row) => (
        <span className={MONEY}>{formatInr(row.consultation_fee_inr)}</span>
      ),
      sortValue: (row) => row.consultation_fee_inr,
      priority: "secondary",
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          isActive={row.is_active}
          verification={row.verification_status}
          isDemoRecord={isSeededDemoPractitioner(row.id)}
        />
      ),
      sortValue: (row) => row.verification_status,
    },
    {
      id: "active",
      header: "Accepting patients",
      cell: (row) =>
        isSeededDemoPractitioner(row.id) ? (
          <Badge tone="violet">Preview only</Badge>
        ) : (
          <div onClick={(event) => event.stopPropagation()}>
            <ActiveSwitch
              checked={row.is_active}
              disabled={busyId === row.id}
              label={`Toggle ${row.profiles.full_name} active`}
              onChange={() => onToggleActive(row)}
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
            onAudit(row.id);
          }}
          className={ROW_MICRO}
        >
          <FileSearch className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  const statusFilter: DataFilter<PractitionerWithProfile> = {
    active: filter,
    options: [
      { id: "all", label: "All" },
      { id: "pending", label: "Pending review" },
      { id: "verified", label: "Verified" },
      { id: "inactive", label: "Inactive" },
      { id: "demo", label: "Demo" },
    ],
    onChange: (id) => onFilterChange(id as PractitionerFilterId),
    match: matchesFilter,
  };

  const hasNoPractitioners = rows.length === 0 && filter === "all";

  return (
    <DataTable
      caption="Practitioners"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      searchText={(row) =>
        `${row.profiles.full_name} ${row.registration_number} ${row.qualification}`
      }
      searchPlaceholder="Search name, registration or qualification"
      filter={statusFilter}
      onRowClick={(row) => onAudit(row.id)}
      isLoading={isLoading}
      emptyState={
        <EmptyState
          icon={Stethoscope}
          title={
            hasNoPractitioners
              ? "No practitioners registered"
              : "No matching practitioners"
          }
          description={
            hasNoPractitioners
              ? "Verified doctors and nutritionists will appear here."
              : "Try another search or filter, or clear the current criteria."
          }
        />
      }
    />
  );
}
