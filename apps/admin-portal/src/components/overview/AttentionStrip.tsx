import {
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Package,
  PackageX,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";
import type { DashboardSummary } from "../../hooks/useDashboardSummary";
import type { TabId } from "../shell/navConfig";

interface AttentionItem {
  label: string;
  count: number;
  target: TabId;
  Icon: LucideIcon;
  urgent: boolean;
}

// Things that need an operator today. Each one opens the table where the work is done.
export function AttentionStrip({
  summary,
  onNavigate,
}: {
  summary: DashboardSummary;
  onNavigate: (id: TabId) => void;
}) {
  const items: AttentionItem[] = [
    {
      label: "Doctors to verify",
      count: summary.attention.pending_verifications,
      target: "practitioners",
      Icon: ShieldCheck,
      urgent: false,
    },
    {
      label: "Failed payments, 24h",
      count: summary.attention.failed_payments_24h,
      target: "finance",
      Icon: CreditCard,
      urgent: true,
    },
    {
      label: "Paid, not shipped",
      count: summary.attention.paid_unshipped,
      target: "orders",
      Icon: Package,
      urgent: false,
    },
    {
      label: "Low stock",
      count: summary.attention.low_stock,
      target: "shop",
      Icon: PackageX,
      urgent: false,
    },
    {
      label: "Open compliance",
      count: summary.attention.open_compliance,
      target: "compliance",
      Icon: FileCheck2,
      urgent: false,
    },
  ];
  const activeItems = items.filter((item) => item.count > 0);
  const clearItems = items.filter((item) => item.count === 0);
  const outstanding = activeItems.length;
  const activeGridClass =
    activeItems.length === 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : activeItems.length === 4
        ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
        : activeItems.length === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : activeItems.length === 2
            ? "grid-cols-2"
            : "grid-cols-1";

  return (
    <section
      aria-labelledby="attention-title"
      className="space-y-2 md:space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2
          id="attention-title"
          className="text-base font-semibold text-text-primary"
        >
          Needs attention
        </h2>
        <p className="text-[13px] text-text-muted">
          {outstanding === 0
            ? "Nothing outstanding"
            : `${outstanding} of ${items.length} queues have work`}
        </p>
      </div>
      {activeItems.length > 0 && (
        <ul className={cn("grid gap-3", activeGridClass)}>
          {activeItems.map((item, index) => {
            const { Icon } = item;
            const fillsLastMobileRow =
              activeItems.length > 1 &&
              activeItems.length % 2 === 1 &&
              index === activeItems.length - 1;
            return (
              <li
                key={item.label}
                className={
                  fillsLastMobileRow ? "col-span-2 sm:col-span-1" : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => onNavigate(item.target)}
                  className={cn(
                    "flex min-h-20 w-full flex-col justify-between rounded-2xl border p-3 text-left transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue sm:min-h-[96px] sm:p-4",
                    fillsLastMobileRow &&
                      "flex-row items-center gap-4 sm:flex-col sm:items-stretch sm:gap-0",
                    item.urgent
                      ? "border-accent-red/40 bg-accent-red/5 hover:border-accent-red/60"
                      : "border-accent-amber/40 bg-accent-amber/5 hover:border-accent-amber/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-between gap-2",
                      fillsLastMobileRow && "min-w-0 flex-1 sm:flex-initial",
                    )}
                  >
                    <span
                      className={cn(
                        "min-w-0 text-[13px] font-medium text-text-secondary",
                        fillsLastMobileRow && "truncate",
                      )}
                    >
                      {item.label}
                    </span>
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        item.urgent ? "text-accent-red" : "text-accent-amber",
                      )}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={cn(
                      "mt-3 flex items-baseline gap-2",
                      fillsLastMobileRow &&
                        "mt-0 shrink-0 whitespace-nowrap sm:mt-3",
                    )}
                  >
                    <span className="font-mono text-2xl font-semibold tabular-nums text-text-primary">
                      {item.count}
                    </span>
                    <span className="text-[12px] text-text-muted">open</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {clearItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-aura-line pt-2">
          <p className="mr-1 text-xs text-text-muted">Clear queues</p>
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {clearItems.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.target)}
                  aria-label={`${item.label}: 0, all clear`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                >
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-accent-emerald"
                    aria-hidden="true"
                  />
                  {item.label}
                  <span className="font-mono tabular-nums">0</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
