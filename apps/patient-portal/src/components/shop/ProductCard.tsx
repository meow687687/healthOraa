import { Badge, BTN_PRIMARY, PANEL, cn } from "@healthoraa/ui";
import { formatPaise, rupeesToPaise } from "../../lib/money";
import { CATEGORY_LABEL, CATEGORY_VISUAL } from "../../lib/categoryMeta";
import type { ShopProduct } from "../../types/shop";

// Stock below this shows an amber warning, so the patient can decide before adding.
export const LOW_STOCK_THRESHOLD = 5;

export function ProductCard({ product, onAdd, adding }: { product: ShopProduct; onAdd: () => void; adding: boolean }) {
  const visual = CATEGORY_VISUAL[product.category];
  const Icon = visual.icon;
  const soldOut = product.stock <= 0;
  const low = !soldOut && product.stock < LOW_STOCK_THRESHOLD;

  return (
    <article className={cn(PANEL, "flex flex-col gap-4 p-4")}>
      <div
        role="img"
        aria-label={`${product.title} preview`}
        className={cn("flex aspect-[4/3] items-center justify-center rounded-2xl border border-aura-line bg-gradient-to-br", visual.tile)}
      >
        <Icon className="h-10 w-10" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Badge tone="neutral">{CATEGORY_LABEL[product.category]}</Badge>
        <span className="font-mono text-[11px] text-text-muted">{product.sku}</span>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">{product.title}</h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">{product.description}</p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-base font-bold text-white">{formatPaise(rupeesToPaise(product.priceInr))}</p>
          {soldOut && <p className="text-xs font-semibold text-accent-red">Out of stock</p>}
          {low && <p className="text-xs font-semibold text-accent-amber">Only {product.stock} left</p>}
          {!soldOut && !low && <p className="text-xs text-text-muted">In stock</p>}
        </div>
        <button type="button" onClick={onAdd} disabled={soldOut || adding} className={cn(BTN_PRIMARY, "shrink-0 px-4 py-2 text-xs")}>
          {adding ? "Adding..." : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}
