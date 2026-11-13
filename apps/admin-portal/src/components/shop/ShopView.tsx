import { EmptyState } from "@healthoraa/ui";
import { useState } from "react";
import { Loader2, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { Product } from "@healthoraa/types";
import { useProducts, useToggleProductActive } from "../../hooks/useProducts";
import { formatInr } from "../programs/programMeta";
import CreateProductDrawer from "./CreateProductDrawer";
import { LOW_STOCK_THRESHOLD, PRODUCT_CATEGORY_META } from "./productMeta";
import { Badge } from "../ui/Badge";
import { ActiveSwitch } from "../ui/Switch";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import { BTN_PRIMARY, ERROR_BOX, MONEY, NUM, PANEL, ROW_MICRO, TABLE_HEAD } from "../ui/tokens";
import { cn } from "../../lib/cn";

export default function ShopView() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: products, isLoading, isError, error } = useProducts();
  const toggleActive = useToggleProductActive();

  const busyId = toggleActive.isPending ? toggleActive.variables?.id : undefined;
  const lowStockCount = products?.filter((p) => p.stock_count < LOW_STOCK_THRESHOLD).length ?? 0;

  return (
    <div className="space-y-6">
      <ViewHeader
        icon={ShoppingBag}
        tone="violet"
        title="Wellness Store Catalog"
        subtitle={
          products
            ? `${products.length} SKU${products.length === 1 ? "" : "s"} · ${lowStockCount} low stock`
            : "Loading catalog..."
        }
        action={
          <button type="button" onClick={() => setIsDrawerOpen(true)} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" />
            Create Product
          </button>
        }
      />

      <div className={cn(PANEL, "overflow-hidden")}>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading products...
          </div>
        )}

        {isError && <div className={ERROR_BOX}>Could not load products: {error.message}</div>}

        {!isLoading && !isError && products?.length === 0 && (
          <EmptyState
            icon={ShoppingBag}
            title="No products yet"
            description="Add a SKU to start stocking the wellness store."
            action={{ label: "Create Product", onClick: () => setIsDrawerOpen(true) }}
            className="border-0 bg-transparent shadow-none"
          />
        )}

        {!isLoading && !isError && products && products.length > 0 && (
          <div className="table-scroll overflow-x-auto -mx-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="px-6 py-4 font-medium">SKU</th>
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Price</th>
                  <th className="px-6 py-4 font-medium">Stock</th>
                  <th className="px-6 py-4 font-medium">Active</th>
                  <th className="px-6 py-4 font-medium w-28" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {products.map((product: Product) => {
                  const isSelected = selectedId === product.id;
                  const busy = busyId === product.id;
                  const meta = PRODUCT_CATEGORY_META[product.category];
                  const isLow = product.stock_count < LOW_STOCK_THRESHOLD;
                  return (
                    <tr
                      key={product.id}
                      onClick={() => setSelectedId(product.id)}
                      className={cn(
                        "group border-b border-aura-line last:border-0 transition-colors cursor-pointer",
                        isSelected ? "bg-aura-s2" : "hover:bg-aura-s2/60",
                      )}
                    >
                      <td className="px-6 py-4 font-mono font-semibold whitespace-nowrap text-text-primary">{product.sku}</td>
                      <td className="px-6 py-4">
                        <p className="text-text-primary">{product.title}</p>
                        {product.description && (
                          <p className="text-xs text-text-muted line-clamp-1 max-w-xs">{product.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className={cn("px-6 py-4", MONEY)}>{formatInr(product.price_inr)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn(NUM, isLow && "text-accent-amber font-semibold")}>
                            {product.stock_count}
                          </span>
                          {isLow && <Badge tone="amber">Low</Badge>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ActiveSwitch
                          checked={product.is_active}
                          disabled={busy}
                          label={`Toggle ${product.title} active`}
                          onChange={(next) => toggleActive.mutate({ id: product.id, isActive: next })}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <RowActions active={isSelected}>
                          <button type="button" disabled title="Edit (coming soon)" aria-label="Edit product" className={ROW_MICRO}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" disabled title="Delete (coming soon)" aria-label="Delete product" className={ROW_MICRO}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {toggleActive.isError && (
              <p className="px-6 py-3 text-xs text-accent-red border-t border-aura-line">
                Could not update status: {toggleActive.error.message}
              </p>
            )}
          </div>
        )}
      </div>

      <CreateProductDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
