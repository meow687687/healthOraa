import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@healthoraa/ui";
import { formatPaise, rupeesToPaise } from "../../../lib/money";
import type { CartEntry, ShopProduct } from "../../../types/shop";

export function CartLineItem({
  entry,
  busy,
  onQuantity,
  onRemove,
}: {
  entry: CartEntry;
  busy: boolean;
  onQuantity: (product: ShopProduct, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  if (!entry.product) {
    return (
      <li className="flex items-center justify-between gap-3 rounded-2xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3">
        <p className="text-xs text-accent-amber">An item in your cart is no longer available.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(entry.productId)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-accent-amber hover:bg-accent-amber/10 disabled:opacity-40"
        >
          Remove
        </button>
      </li>
    );
  }

  const { product, quantity } = entry;
  const atMax = quantity >= product.stock;
  const lineTotal = rupeesToPaise(product.priceInr) * quantity;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-aura-line bg-aura-s2 p-4">
      <div className="min-w-[10rem] flex-1 space-y-1">
        <p className="truncate text-sm font-semibold text-text-primary">{product.title}</p>
        <p className="font-mono text-xs tabular-nums text-text-muted">{formatPaise(rupeesToPaise(product.priceInr))} each</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-full border border-aura-line2 bg-aura-s3 p-1">
        <button
          type="button"
          aria-label={`Decrease quantity of ${product.title}`}
          disabled={busy || quantity <= 1}
          onClick={() => onQuantity(product, quantity - 1)}
          className="rounded-full p-1.5 text-text-secondary hover:text-white disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span aria-live="polite" className="min-w-[2ch] text-center font-mono text-sm tabular-nums text-white">
          {quantity}
        </span>
        <button
          type="button"
          aria-label={`Increase quantity of ${product.title}`}
          disabled={busy || atMax}
          onClick={() => onQuantity(product, quantity + 1)}
          className="rounded-full p-1.5 text-text-secondary hover:text-white disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className={cn("w-24 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-text-primary")}>
        {formatPaise(lineTotal)}
      </p>

      <button
        type="button"
        aria-label={`Remove ${product.title}`}
        disabled={busy}
        onClick={() => onRemove(product.id)}
        className="rounded-full p-2 text-text-muted hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      </div>
    </li>
  );
}
