import { DataTable, EmptyState, type DataColumn, type DataFilter } from "@healthoraa/ui";
import { useState } from "react";
import { Check, ChevronRight, Loader2, Package } from "lucide-react";
import type { OrderStatus } from "@healthoraa/types";
import { ORDER_STATUS_VALUES } from "@healthoraa/validation";
import { useOrders, useUpdateOrderStatus } from "../../hooks/useOrders";
import type { OrderWithCustomer } from "../../hooks/useOrders";
import { formatInr } from "../programs/programMeta";
import { Badge } from "../ui/Badge";
import { ViewHeader } from "../ui/ViewHeader";
import { ERROR_BOX, INPUT, MONEY, NUM, PANEL, ROW_MICRO, TONE_CLASS, type Tone } from "../ui/tokens";
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
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-aura-s1 border border-aura-line p-1"
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

const FILTERS: DataFilter<OrderWithCustomer>["options"] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default function OrdersView() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const { data: orders, isLoading, isError, error, refetch } = useOrders();
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

  const columns: DataColumn<OrderWithCustomer>[] = [
    {
      id: "id",
      header: "Order",
      cell: (order) => <span className={NUM}>#{order.id.slice(0, 8).toUpperCase()}</span>,
      sortValue: (order) => order.id,
    },
    {
      id: "customer",
      header: "Customer",
      cell: (order) => (
        <div className="min-w-0 max-w-xs">
          <p className="font-semibold text-text-primary">{order.profiles.full_name}</p>
          <p className="text-xs text-text-muted line-clamp-1">{order.shipping_address}</p>
        </div>
      ),
      sortValue: (order) => order.profiles.full_name,
      priority: "secondary",
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      cell: (order) => <span className={MONEY}>{formatInr(order.total_amount_inr)}</span>,
      sortValue: (order) => order.total_amount_inr,
    },
    {
      id: "date",
      header: "Date",
      cell: (order) => (
        <span className={NUM}>
          {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      ),
      sortValue: (order) => order.created_at,
      priority: "secondary",
    },
    {
      id: "status",
      header: "Status",
      cell: (order) => <Badge tone={STATUS_META[order.status].tone}>{STATUS_META[order.status].label}</Badge>,
      sortValue: (order) => order.status,
    },
    {
      id: "update",
      header: "Update",
      cell: (order) => {
        const busy = updatingId === order.id;
        const next = NEXT_STATUS[order.status];
        return (
          <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusStepper status={order.status} busy={busy} onSelect={(nextStatus) => handleSelect(order, nextStatus)} />
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
            </div>
            {order.status === "shipped" && (
              <input
                type="text"
                aria-label="Tracking number"
                placeholder="Tracking number"
                value={trackingDraft[order.id] ?? order.tracking_number ?? ""}
                onChange={(e) => setTrackingDraft((prev) => ({ ...prev, [order.id]: e.target.value }))}
                className={cn(INPUT, "py-1.5 text-xs font-mono")}
              />
            )}
          </div>
        );
      },
    },
  ];

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

      {isError && <div className={ERROR_BOX}>Could not load orders: {error.message}</div>}

      {!isError && (
        <div className={cn(PANEL, "overflow-hidden")}>
          <DataTable
            caption="Customer orders"
            rows={orders ?? []}
            columns={columns}
            getRowId={(order) => order.id}
            searchText={(order) => `${order.profiles.full_name} ${order.shipping_address} ${order.id}`}
            searchPlaceholder="Search customer, address or order ID"
            filter={{
              active: statusFilter,
              options: FILTERS,
              onChange: setStatusFilter,
              match: (order, id) => id === "all" || order.status === id,
            }}
            isLoading={isLoading}
            emptyState={
              <EmptyState
                icon={Package}
                title="No orders yet"
                description="Orders placed in the wellness store will appear here."
                action={{ label: "Refresh orders", onClick: () => void refetch() }}
              />
            }
          />
          {updateStatus.isError && (
            <p className="px-6 py-3 text-xs text-accent-red border-t border-aura-line">
              Could not update order: {updateStatus.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
