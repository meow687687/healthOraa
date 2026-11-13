import { ShoppingBag } from "lucide-react";
import { EmptyState } from "@healthoraa/ui";
import { formatCount, formatInrCompact } from "../../lib/format";
import type { DashboardSummary } from "../../hooks/useDashboardSummary";

export function TopProducts({ summary }: { summary: DashboardSummary }) {
  const products = summary.top_products;
  const max = Math.max(...products.map((product) => product.units), 0);

  return (
    <section aria-labelledby="top-products-title" className="rounded-3xl border border-aura-line bg-aura-s1 p-5 shadow-aura-card md:p-6 lg:col-span-3">
      <h2 id="top-products-title" className="text-base font-semibold text-text-primary">
        Top products
      </h2>
      <p className="mt-1 text-[13px] text-text-muted">Units sold, last {summary.window_days} days</p>
      <div className="mt-5">
        {products.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No sales yet" description="Best sellers appear once orders are placed." />
        ) : (
          <ol className="space-y-4">
            {products.map((product) => (
              <li key={product.id}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-text-secondary">{product.title}</span>
                  <span className="shrink-0 font-mono tabular-nums text-text-primary">{formatCount(product.units)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-aura-s3" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent-emerald" style={{ width: `${(product.units / max) * 100}%` }} />
                </div>
                <p className="mt-1 font-mono text-[12px] text-text-muted">{formatInrCompact(product.revenue_inr)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
