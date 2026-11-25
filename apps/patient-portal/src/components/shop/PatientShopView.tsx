import { ShoppingBag } from "lucide-react";
import { ERROR_BOX, EmptyState, LABEL } from "@healthoraa/ui";
import { useAuth } from "../../context/AuthContext";
import { useShopProducts } from "../../hooks/usePatientShop";
import { ProductCard } from "./ProductCard";

export default function PatientShopView() {
  const { isDemoData } = useAuth();
  const products = useShopProducts();

  if (products.isPending) {
    return <p className="py-16 text-center text-sm text-text-secondary">Loading the shop...</p>;
  }

  const productList = products.data ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <p className={LABEL}>Wellness shop</p>
        <h2 className="text-xl font-bold tracking-tight text-white">Supplements, skincare and equipment</h2>
        <p className="text-sm text-text-secondary">Catalog preview. Ordering is not available here.</p>
      </header>

      {isDemoData && (
        <aside aria-label="Sample catalog notice" className="rounded-2xl border border-aura-line bg-aura-s2 p-4 text-sm text-text-secondary">
          Sample listings only. Product claims, prices, stock, and delivery terms need client approval.
        </aside>
      )}

      {products.isError && <div className={ERROR_BOX} role="alert">{products.error.message}</div>}

      {productList.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No products to preview"
          description="Example products will appear here when they are available."
          action={{ label: "Refresh catalog", onClick: () => void products.refetch() }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {productList.map((product) => (
            <ProductCard key={product.id} product={product} sampleOnly={isDemoData} />
          ))}
        </div>
      )}
    </div>
  );
}
