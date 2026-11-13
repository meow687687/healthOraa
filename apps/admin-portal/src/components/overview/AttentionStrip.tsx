import { CheckCircle2, CreditCard, FileCheck2, Package, PackageX, ShieldCheck, type LucideIcon } from "lucide-react";
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
export function AttentionStrip({ summary, onNavigate }: { summary: DashboardSummary; onNavigate: (id: TabId) => void }) {
  const items: AttentionItem[] = [
    { label: "Doctors to verify", count: summary.attention.pending_verifications, target: "practitioners", Icon: ShieldCheck, urgent: false },
    { label: "Failed payments, 24h", count: summary.attention.failed_payments_24h, target: "finance", Icon: CreditCard, urgent: true },
    { label: "Paid, not shipped", count: summary.attention.paid_unshipped, target: "orders", Icon: Package, urgent: false },
    { label: "Low stock", count: summary.attention.low_stock, target: "shop", Icon: PackageX, urgent: false },
    { label: "Open compliance", count: summary.attention.open_compliance, target: "compliance", Icon: FileCheck2, urgent: false },
  ];
  const outstanding = items.filter((item) => item.count > 0).length;

  return (
    <section aria-labelledby="attention-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="attention-title" className="text-base font-semibold text-text-primary">
          Needs attention
        </h2>
        <p className="text-[13px] text-text-muted">{outstanding === 0 ? "Nothing outstanding" : `${outstanding} of ${items.length} queues have work`}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {items.map((item) => {
          const clear = item.count === 0;
          const { Icon } = item;
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => onNavigate(item.target)}
                className={cn(
                  "flex min-h-[96px] w-full flex-col justify-between rounded-2xl border p-4 text-left transition-colors duration-150 cursor-pointer",
                  clear ? "border-aura-line bg-aura-s1 hover:border-aura-line2" : item.urgent ? "border-accent-red/40 bg-accent-red/5 hover:border-accent-red/60" : "border-accent-amber/40 bg-accent-amber/5 hover:border-accent-amber/60",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-text-secondary">{item.label}</span>
                  {clear ? (
                    <CheckCircle2 className="h-4 w-4 text-accent-emerald" aria-hidden="true" />
                  ) : (
                    <Icon className={cn("h-4 w-4", item.urgent ? "text-accent-red" : "text-accent-amber")} aria-hidden="true" />
                  )}
                </span>
                <span className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold tabular-nums text-text-primary">{item.count}</span>
                  <span className="text-[12px] text-text-muted">{clear ? "All clear" : "open"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
