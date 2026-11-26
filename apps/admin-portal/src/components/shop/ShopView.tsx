import { EmptyState } from "@healthoraa/ui";
import { useState } from "react";
import { Loader2, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { Product } from "@healthoraa/types";
import { useDeleteProduct, useProducts, useToggleProductActive } from "../../hooks/useProducts";
import { formatInr } from "../programs/programMeta";
import CreateProductDrawer from "./CreateProductDrawer";
import { isLowStockProduct, PRODUCT_CATEGORY_META } from "./productMeta";
import { Badge } from "../ui/Badge";
import { ActiveSwitch } from "../ui/Switch";
import { RowActions } from "../ui/RowActions";
import { ViewHeader } from "../ui/ViewHeader";
import { BTN_PRIMARY, ERROR_BOX, MONEY, NUM, PANEL, ROW_MICRO, TABLE_HEAD } from "../ui/tokens";
import { cn } from "../../lib/cn";

export default function ShopView() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { data: products, isLoading, isError, error } = useProducts();
  const toggleActive = useToggleProductActive();
  const deleteProduct = useDeleteProduct();

  const busyId = toggleActive.isPending
    ? toggleActive.variables?.id
    : deleteProduct.isPending
      ? deleteProduct.variables
      : undefined;
  const lowStockCount = products?.filter(isLowStockProduct).length ?? 0;

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
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setIsDrawerOpen(true);
            }}
            className={BTN_PRIMARY}
          >
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
          <div className="space-y-3 px-4 py-4 md:hidden">
            {products.map((product) => {
              const busy = busyId === product.id;
              const meta = PRODUCT_CATEGORY_META[product.category];
              const isLow = isLowStockProduct(product);
              return (
                <article key={product.id} className="rounded-2xl border border-aura-line bg-aura-s2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold text-text-muted">{product.sku}</p>
                      <h3 className="mt-1 font-semibold text-text-primary">{product.title}</h3>
                      {product.description && <p className="mt-1 line-clamp-2 text-xs text-text-muted">{product.description}</p>}
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-aura-s1/70 p-3">
                    <div><dt className="text-[11px] text-text-muted">Price</dt><dd className={cn("mt-1", MONEY)}>{formatInr(product.price_inr)}</dd></div>
                    <div><dt className="text-[11px] text-text-muted">Stock</dt><dd className="mt-1 flex items-center gap-2"><span className={cn(NUM, isLow && "font-semibold text-accent-amber")}>{product.stock_count}</span>{isLow && <Badge tone="amber">Low stock</Badge>}</dd></div>
                  </dl>
                  <div className="mt-4 flex items-center justify-between border-t border-aura-line pt-3">
                    <span className="text-xs text-text-secondary">{product.is_active ? "Active in store" : "Hidden from store"}</span>
                    <ActiveSwitch checked={product.is_active} disabled={busy} label={`Toggle ${product.title} active`} onChange={(next) => toggleActive.mutate({ id: product.id, isActive: next })} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => { setEditingProduct(product); setIsDrawerOpen(true); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-aura-line2 bg-aura-s1 px-3 text-xs font-semibold text-text-primary">
                      <Pencil className="h-3.5 w-3.5" /> Edit product
                    </button>
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete ${product.title}? Products in customer carts or order history will be protected.`)) deleteProduct.mutate(product.id); }} aria-label={`Delete ${product.title}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-aura-line2 bg-aura-s1 px-3 text-xs font-semibold text-accent-red disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!isLoading && !isError && products && products.length > 0 && (
          <div className="table-scroll -mx-6 hidden overflow-x-auto md:block">
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
                  const isLow = isLowStockProduct(product);
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
                          <button
                            type="button"
                            title="Edit product"
                            aria-label={`Edit ${product.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingProduct(product);
                              setIsDrawerOpen(true);
                            }}
                            className={ROW_MICRO}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            title="Delete product"
                            aria-label={`Delete ${product.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (window.confirm(`Delete ${product.title}? Products in customer carts or order history will be protected.`)) {
                                deleteProduct.mutate(product.id);
                              }
                            }}
                            className={ROW_MICRO}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(toggleActive.isError || deleteProduct.isError) && (
          <p className="border-t border-aura-line px-6 py-3 text-xs text-accent-red">
            {deleteProduct.isError ? deleteProduct.error.message : `Could not update status: ${toggleActive.error?.message ?? "Try again."}`}
          </p>
        )}
      </div>

      <CreateProductDrawer
        key={editingProduct?.id ?? "new-product"}
        isOpen={isDrawerOpen}
        product={editingProduct}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingProduct(null);
        }}
      />
    </div>
  );
}
