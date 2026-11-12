import { useMemo, useState } from "react";
import { Copy, Eye, Loader2, Receipt } from "lucide-react";
import type { PaymentStatus } from "@healthoraa/types";
import { usePayments } from "../../hooks/usePayments";
import type { PaymentWithCustomer } from "../../hooks/usePayments";
import { formatInr } from "../programs/programMeta";
import { Badge } from "../ui/Badge";
import { Drawer, DrawerHeader } from "../ui/Drawer";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import { ERROR_BOX, LABEL, MONEY, NUM, PANEL, ROW_MICRO, TABLE_HEAD, type Tone } from "../ui/tokens";
import { cn } from "../../lib/cn";

type FilterValue = "all" | Extract<PaymentStatus, "captured" | "failed" | "refunded">;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "captured", label: "Captured" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  initiated: { label: "Initiated", tone: "amber" },
  captured: { label: "Captured", tone: "emerald" },
  failed: { label: "Failed", tone: "red" },
  refunded: { label: "Refunded", tone: "neutral" },
};

function SegmentedFilter({
  value,
  counts,
  onChange,
}: {
  value: FilterValue;
  counts: Record<FilterValue, number>;
  onChange: (next: FilterValue) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter by payment status"
      className="inline-flex items-center gap-1 rounded-full bg-aura-s1 border border-aura-line2 p-1"
    >
      {FILTERS.map((filter) => {
        const selected = value === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(filter.value)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all",
              selected ? "bg-aura-s3 text-text-primary shadow-aura-elevated" : "text-text-muted hover:text-text-primary",
            )}
          >
            {filter.label}
            <span className="font-mono tabular-nums text-[10px] text-text-muted">{counts[filter.value]}</span>
          </button>
        );
      })}
    </div>
  );
}

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
  const { data: payments, isLoading, isError, error } = usePayments();

  const counts = useMemo<Record<FilterValue, number>>(() => {
    const base: Record<FilterValue, number> = {
      all: payments?.length ?? 0,
      captured: 0,
      failed: 0,
      refunded: 0,
    };
    for (const p of payments ?? []) {
      if (p.status in base) base[p.status as FilterValue] += 1;
    }
    return base;
  }, [payments]);

  const visible = useMemo(
    () => (payments ?? []).filter((p) => filter === "all" || p.status === filter),
    [payments, filter],
  );

  const capturedTotal = useMemo(
    () =>
      (payments ?? [])
        .filter((p) => p.status === "captured")
        .reduce((sum, p) => sum + p.amount_inr, 0),
    [payments],
  );

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
        action={<SegmentedFilter value={filter} counts={counts} onChange={setFilter} />}
      />

      <div className={cn(PANEL, "overflow-hidden")}>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading transactions...
          </div>
        )}

        {isError && <div className={ERROR_BOX}>Could not load transactions: {error.message}</div>}

        {!isLoading && !isError && payments?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-semibold text-text-primary">No transactions yet</p>
            <p className="text-xs text-text-muted">Razorpay payments will be reconciled here as they are captured.</p>
          </div>
        )}

        {!isLoading && !isError && payments && payments.length > 0 && visible.length === 0 && (
          <div className="py-16 text-center text-xs text-text-muted">No {filter} transactions.</div>
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <div className="table-scroll overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="px-6 py-4 font-medium">Transaction ID</th>
                  <th className="px-6 py-4 font-medium">Razorpay Payment ID</th>
                  <th className="px-6 py-4 font-medium">Linked Record</th>
                  <th className="px-6 py-4 font-medium">Gross Amount</th>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium w-24" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((payment) => (
                  <tr
                    key={payment.id}
                    onClick={() => setSelected(payment)}
                    className="group border-b border-aura-line last:border-0 hover:bg-aura-s2/60 transition-colors cursor-pointer"
                  >
                    <td className={cn("px-6 py-4", NUM)}>#{payment.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-primary">{payment.gateway_payment_id ?? "—"}</td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-xs text-text-secondary">
                        {payment.linked_order_id
                          ? `ORD ${payment.linked_order_id.slice(0, 8).toUpperCase()}`
                          : payment.linked_consultation_id
                            ? `CON ${payment.linked_consultation_id.slice(0, 8).toUpperCase()}`
                            : "Unlinked"}
                      </p>
                      <p className="text-xs text-text-muted">{payment.customer_name ?? "No customer"}</p>
                    </td>
                    <td className={cn("px-6 py-4", MONEY)}>{formatInr(payment.amount_inr)}</td>
                    <td className={cn("px-6 py-4", NUM)}>
                      {new Date(payment.created_at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={STATUS_META[payment.status].tone}>{STATUS_META[payment.status].label}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <RowActions active={selected?.id === payment.id}>
                        <button
                          type="button"
                          title="View record"
                          aria-label="View record"
                          onClick={() => setSelected(payment)}
                          className={ROW_MICRO}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Copy Razorpay payment ID"
                          aria-label="Copy Razorpay payment ID"
                          disabled={!payment.gateway_payment_id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void navigator.clipboard.writeText(payment.gateway_payment_id ?? "");
                          }}
                          className={ROW_MICRO}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetailDrawer payment={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
