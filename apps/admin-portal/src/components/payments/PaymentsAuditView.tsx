import { DataTable, EmptyState, type DataColumn, type DataFilter } from "@healthoraa/ui";
import { useMemo, useState } from "react";
import { Copy, Eye, Receipt } from "lucide-react";
import type { PaymentStatus } from "@healthoraa/types";
import { usePayments } from "../../hooks/usePayments";
import type { PaymentWithCustomer } from "../../hooks/usePayments";
import { formatInr } from "../programs/programMeta";
import { Badge } from "../ui/Badge";
import { Drawer, DrawerHeader } from "../ui/Drawer";
import { ViewHeader } from "../ui/ViewHeader";
import { ERROR_BOX, LABEL, MONEY, NUM, PANEL, ROW_MICRO, type Tone } from "../ui/tokens";
import { cn } from "../../lib/cn";

type FilterValue = "all" | Extract<PaymentStatus, "captured" | "failed" | "refunded">;

const FILTERS: { id: FilterValue; label: string }[] = [
  { id: "all", label: "All" },
  { id: "captured", label: "Captured" },
  { id: "failed", label: "Failed" },
  { id: "refunded", label: "Refunded" },
];

const STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  initiated: { label: "Initiated", tone: "amber" },
  captured: { label: "Captured", tone: "emerald" },
  failed: { label: "Failed", tone: "red" },
  refunded: { label: "Refunded", tone: "neutral" },
};

function DetailDrawer({ payment, onClose }: { payment: PaymentWithCustomer | null; onClose: () => void }) {
  const json = payment ? JSON.stringify(payment, null, 2) : "";

  return (
    <Drawer isOpen={payment !== null} onClose={onClose} labelledBy="payment-detail-title">
      <DrawerHeader
        eyebrow="Transaction Audit"
        title={
          <span className="font-mono text-sm font-semibold break-all">
            {payment?.gateway_payment_id ?? "No gateway payment ID"}
          </span>
        }
        titleId="payment-detail-title"
        onClose={onClose}
      >
        {payment && <Badge tone={STATUS_META[payment.status].tone}>{STATUS_META[payment.status].label}</Badge>}
      </DrawerHeader>

      {payment && (
        <div className="flex-1 space-y-5 py-6">
          {payment.error_code && (
            <div className="rounded-2xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 space-y-1">
              <p className="text-xs font-mono uppercase tracking-wider text-accent-red">{payment.error_code}</p>
              {payment.error_description && (
                <p className="text-sm text-text-primary">{payment.error_description}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className={LABEL}>Record Payload</p>
            <pre className="max-h-[60vh] overflow-auto rounded-xl bg-aura-s2 border border-aura-line p-4 text-xs leading-relaxed font-mono text-text-secondary">
              {json}
            </pre>
            <p className="text-xs text-text-muted">
              Stored row fields only. Raw gateway responses and webhook signatures are not persisted in this table.
            </p>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default function PaymentsAuditView() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selected, setSelected] = useState<PaymentWithCustomer | null>(null);
  const { data: payments, isLoading, isError, error, refetch } = usePayments();

  const counts = useMemo<Record<FilterValue, number>>(() => {
    const base: Record<FilterValue, number> = { all: payments?.length ?? 0, captured: 0, failed: 0, refunded: 0 };
    for (const p of payments ?? []) {
      if (p.status in base) base[p.status as FilterValue] += 1;
    }
    return base;
  }, [payments]);

  const capturedTotal = useMemo(
    () => (payments ?? []).filter((p) => p.status === "captured").reduce((sum, p) => sum + p.amount_inr, 0),
    [payments],
  );

  const columns: DataColumn<PaymentWithCustomer>[] = [
    {
      id: "id",
      header: "Transaction",
      cell: (payment) => <span className={NUM}>#{payment.id.slice(0, 8).toUpperCase()}</span>,
      sortValue: (payment) => payment.id,
    },
    {
      id: "gateway",
      header: "Razorpay ID",
      cell: (payment) => <span className="font-mono text-xs text-text-primary">{payment.gateway_payment_id ?? "—"}</span>,
      sortValue: (payment) => payment.gateway_payment_id ?? "",
      priority: "secondary",
    },
    {
      id: "linked",
      header: "Linked record",
      cell: (payment) => (
        <div>
          <p className="font-mono text-xs text-text-secondary">
            {payment.linked_order_id
              ? `ORD ${payment.linked_order_id.slice(0, 8).toUpperCase()}`
              : payment.linked_consultation_id
                ? `CON ${payment.linked_consultation_id.slice(0, 8).toUpperCase()}`
                : "Unlinked"}
          </p>
          <p className="text-xs text-text-muted">{payment.customer_name ?? "No customer"}</p>
        </div>
      ),
      sortValue: (payment) => payment.customer_name ?? "",
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (payment) => <span className={MONEY}>{formatInr(payment.amount_inr)}</span>,
      sortValue: (payment) => payment.amount_inr,
    },
    {
      id: "time",
      header: "When",
      cell: (payment) => (
        <span className={NUM}>
          {new Date(payment.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
      sortValue: (payment) => payment.created_at,
      priority: "secondary",
    },
    {
      id: "status",
      header: "Status",
      cell: (payment) => <Badge tone={STATUS_META[payment.status].tone}>{STATUS_META[payment.status].label}</Badge>,
      sortValue: (payment) => payment.status,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (payment) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <button type="button" title="View record" aria-label="View record" onClick={() => setSelected(payment)} className={ROW_MICRO}>
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Copy Razorpay payment ID"
            aria-label="Copy Razorpay payment ID"
            disabled={!payment.gateway_payment_id}
            onClick={() => void navigator.clipboard.writeText(payment.gateway_payment_id ?? "")}
            className={ROW_MICRO}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const statusFilter: DataFilter<PaymentWithCustomer> = {
    active: filter,
    options: FILTERS.map((option) => ({ id: option.id, label: `${option.label} ${counts[option.id]}` })),
    onChange: (id) => setFilter(id as FilterValue),
    match: (payment, id) => id === "all" || payment.status === id,
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Receipt}
        tone="emerald"
        title="Payment Reconciliation"
        subtitle={
          payments
            ? `${payments.length} transaction${payments.length === 1 ? "" : "s"} · ${formatInr(capturedTotal)} captured`
            : "Loading transactions..."
        }
      />

      {isError && <div className={ERROR_BOX}>Could not load transactions: {error.message}</div>}

      {!isError && (
        <div className={cn(PANEL, "overflow-hidden")}>
          <DataTable
            caption="Payment transactions"
            rows={payments ?? []}
            columns={columns}
            getRowId={(payment) => payment.id}
            searchText={(payment) => `${payment.gateway_payment_id ?? ""} ${payment.customer_name ?? ""} ${payment.id}`}
            searchPlaceholder="Search Razorpay ID, customer or transaction"
            filter={statusFilter}
            onRowClick={(payment) => setSelected(payment)}
            isLoading={isLoading}
            emptyState={
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Razorpay payments will be reconciled here as they are captured."
                action={{ label: "Refresh transactions", onClick: () => void refetch() }}
              />
            }
          />
        </div>
      )}

      <DetailDrawer payment={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
