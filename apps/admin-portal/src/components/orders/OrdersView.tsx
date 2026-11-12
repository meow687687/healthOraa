import { useState } from "react";
import { Check, ChevronRight, Loader2, Package } from "lucide-react";
import type { OrderStatus } from "@healthoraa/types";
import { ORDER_STATUS_VALUES } from "@healthoraa/validation";
import { useOrders, useUpdateOrderStatus } from "../../hooks/useOrders";
import type { OrderWithCustomer } from "../../hooks/useOrders";
import { formatInr } from "../programs/programMeta";
import { Badge } from "../ui/Badge";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import {
  ERROR_BOX,
  INPUT,
  MONEY,
  NUM,
  PANEL,
  ROW_MICRO,
  TABLE_HEAD,
  TONE_CLASS,
  type Tone,
} from "../ui/tokens";
import { cn } from "../../lib/cn";

const STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "amber" },
  paid: { label: "Paid", tone: "emerald" },
  shipped: { label: "Shipped", tone: "blue" },
  delivered: { label: "Delivered", tone: "emerald" },
  cancelled: { label: "Cancelled", tone: "red" },
};

const WORKFLOW_STEPS: readonly OrderStatus[] = ORDER_STATUS_VALUES;

// Forward-only progression used by the row's advance action.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "paid",
  paid: "shipped",
  shipped: "delivered",
};

function StatusStepper({
  status,
  busy,
  onSelect,
}: {
  status: OrderStatus;
  busy: boolean;
  onSelect: (next: OrderStatus) => void;
}) {
  const currentIndex = WORKFLOW_STEPS.indexOf(status);
  return (
    <div
      role="radiogroup"
      aria-label="Order status"
      className="inline-flex items-center gap-1 rounded-full bg-aura-s1 border border-aura-line p-1"
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const selected = step === status;
        const completed = index < currentIndex;
        const meta = STATUS_META[step];
        return (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={busy}
            onClick={() => onSelect(step)}
            title={`Set to ${meta.label}`}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold font-mono transition-all disabled:opacity-50",
              selected
                ? TONE_CLASS[meta.tone]
                : completed
                  ? "border-aura-line2 text-text-secondary hover:text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary",
            )}
          >
            {completed ? (
              <Check className="w-3 h-3" />
            ) : (
              <span className={cn("w-1.5 h-1.5 rounded-full", selected ? "bg-current" : "bg-text-muted")} />
            )}
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

export default function OrdersView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const { data: orders, isLoading, isError, error } = useOrders();
  const updateStatus = useUpdateOrderStatus();

  const updatingId = updateStatus.isPending ? updateStatus.variables?.id : undefined;
  const pendingCount = orders?.filter((o) => o.status === "pending").length ?? 0;

  const handleSelect = (order: OrderWithCustomer, next: OrderStatus) => {
    if (next === order.status) return;
    updateStatus.mutate({
      id: order.id,
      status: next,
      trackingNumber:
        next === "shipped" ? trackingDraft[order.id] ?? order.tracking_number ?? undefined : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={Package}
        tone="violet"
        title="Customer Orders"
        subtitle={
          orders
            ? `${orders.length} order${orders.length === 1 ? "" : "s"} · ${pendingCount} awaiting payment`
            : "Loading orders..."
        }
      />

      <div className={cn(PANEL, "overflow-hidden")}>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading orders...
          </div>
        )}

        {isError && <div className={ERROR_BOX}>Could not load orders: {error.message}</div>}

        {!isLoading && !isError && orders?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-sm font-semibold text-text-primary">No orders yet</p>
            <p className="text-xs text-text-muted">Orders placed in the wellness store will appear here.</p>
          </div>
        )}

        {!isLoading && !isError && orders && orders.length > 0 && (
          <div className="table-scroll overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="px-6 py-4 font-medium">Order ID</th>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Total</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Update Status</th>
                  <th className="px-6 py-4 font-medium w-20" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const busy = updatingId === order.id;
                  const isSelected = selectedId === order.id;
                  const next = NEXT_STATUS[order.status];
                  const needsTracking = order.status === "shipped";
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      className={cn(
                        "group border-b border-aura-line last:border-0 transition-colors",
                        isSelected ? "bg-aura-s2" : "hover:bg-aura-s2/60",
                      )}
                    >
                      <td className={cn("px-6 py-4", NUM)}>#{order.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary">{order.profiles.full_name}</p>
                        <p className="text-xs text-text-muted line-clamp-1 max-w-xs">{order.shipping_address}</p>
                      </td>
                      <td className={cn("px-6 py-4", MONEY)}>{formatInr(order.total_amount_inr)}</td>
                      <td className={cn("px-6 py-4", NUM)}>
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={STATUS_META[order.status].tone}>{STATUS_META[order.status].label}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <StatusStepper
                            status={order.status}
                            busy={busy}
                            onSelect={(nextStatus) => handleSelect(order, nextStatus)}
                          />
                          {needsTracking && (
                            <input
                              type="text"
                              aria-label="Tracking number"
                              placeholder="Tracking number"
                              value={trackingDraft[order.id] ?? order.tracking_number ?? ""}
                              onChange={(e) =>
                                setTrackingDraft((prev) => ({ ...prev, [order.id]: e.target.value }))
                              }
                              className={cn(INPUT, "py-1.5 text-xs font-mono")}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <RowActions active={isSelected}>
                          <button
                            type="button"
                            disabled={!next || busy}
                            title={next ? `Advance to ${STATUS_META[next].label}` : "No further steps"}
                            aria-label={next ? `Advance to ${STATUS_META[next].label}` : "No further steps"}
                            onClick={() => next && handleSelect(order, next)}
                            className={ROW_MICRO}
                          >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {updateStatus.isError && (
              <p className="px-6 py-3 text-xs text-accent-red border-t border-aura-line">
                Could not update order: {updateStatus.error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
