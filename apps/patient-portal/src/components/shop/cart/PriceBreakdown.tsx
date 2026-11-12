import { LABEL, PANEL, cn } from "@healthoraa/ui";
import { formatPaise } from "../../../lib/money";
import type { CartSummary } from "../../../lib/cartMath";

export function PriceBreakdown({ summary }: { summary: CartSummary }) {
  const row = (label: string, value: string, emphasis = false) => (
    <div className={cn("flex items-center justify-between gap-4 py-2.5", emphasis && "border-t border-aura-line pt-4")}>
      <span className={cn("text-sm", emphasis ? "font-semibold text-text-primary" : "text-text-secondary")}>{label}</span>
      <span className={cn("font-mono tabular-nums", emphasis ? "text-lg font-bold text-white" : "text-sm text-text-primary")}>{value}</span>
    </div>
  );

  return (
    <section aria-labelledby="price-title" className={cn(PANEL, "p-5")}>
      <p id="price-title" className={LABEL}>
        Price breakdown
      </p>
      <div className="mt-2 divide-y divide-aura-line">
        {row(`Subtotal (${summary.units} ${summary.units === 1 ? "item" : "items"})`, formatPaise(summary.subtotalPaise))}
        {row("Standard Delivery", summary.deliveryPaise === 0 ? "Free" : formatPaise(summary.deliveryPaise))}
        {row("Platform GST (18%)", formatPaise(summary.gstPaise))}
        {row("Total", formatPaise(summary.totalPaise), true)}
      </div>
    </section>
  );
}
