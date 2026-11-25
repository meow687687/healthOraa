import { Badge, PANEL, cn } from "@healthoraa/ui";
import { CATEGORY_LABEL, CATEGORY_VISUAL } from "../../lib/categoryMeta";
import type { ShopProduct } from "../../types/shop";

export function ProductCard({ product, sampleOnly }: { product: ShopProduct; sampleOnly: boolean }) {
  const visual = CATEGORY_VISUAL[product.category];
  const Icon = visual.icon;

  return (
    <article className={cn(PANEL, "flex flex-col gap-4 p-4")}>
      <div
        role="img"
        aria-label={`Illustrative ${CATEGORY_LABEL[product.category]} category art; not a product photo.`}
        className={cn("flex h-28 items-center justify-center rounded-2xl border border-aura-line", visual.tile)}
      >
        <Icon className="h-10 w-10" strokeWidth={1.5} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Badge tone="neutral">{CATEGORY_LABEL[product.category]}</Badge>
        {sampleOnly && <Badge tone="violet">Sample listing</Badge>}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">
          {sampleOnly ? `Sample ${CATEGORY_LABEL[product.category]} listing` : product.title}
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
          {sampleOnly ? "Product information is pending client approval." : product.description}
        </p>
      </div>

      <p className="border-t border-aura-line pt-3 text-xs text-text-muted">
        {sampleOnly ? "Pricing and availability are not approved." : "Ordering is not available in this preview."}
      </p>
    </article>
  );
}
