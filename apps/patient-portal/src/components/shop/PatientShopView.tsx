import { useState } from "react";
import { ERROR_BOX, LABEL } from "@healthoraa/ui";
import { useAddToCart, useCart, useRemoveCartItem, useUpdateCartQuantity } from "../../hooks/usePatientShop";
import type { ShopProduct } from "../../types/shop";
import { ProductCard } from "./ProductCard";
import { CartPill } from "./CartPill";
import { CartDrawer } from "./CartDrawer";

export default function PatientShopView() {
  const cart = useCart();
  const addToCart = useAddToCart();
  const updateQuantity = useUpdateCartQuantity();
  const removeItem = useRemoveCartItem();
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (cart.isPending) {
    return <p className="py-16 text-center text-sm text-text-secondary">Loading the shop...</p>;
  }

  const products = cart.products.data ?? [];
  const busy = updateQuantity.isPending || removeItem.isPending;

  const add = (product: ShopProduct) => {
    setNotice(null);
    addToCart.mutate(product, { onError: (error) => setNotice(error.message) });
  };
  const changeQuantity = (product: ShopProduct, quantity: number) => {
    setNotice(null);
    updateQuantity.mutate({ product, quantity }, { onError: (error) => setNotice(error.message) });
  };
  const remove = (productId: string) => {
    setNotice(null);
    removeItem.mutate(productId, { onError: (error) => setNotice(error.message) });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <p className={LABEL}>Wellness shop</p>
        <h2 className="text-xl font-bold tracking-tight text-white">Supplements, skincare and equipment</h2>
        <p className="text-sm text-text-secondary">Free standard delivery across India.</p>
      </header>

      {notice && <div className={ERROR_BOX}>{notice}</div>}

      {products.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-muted">No products are available right now.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              adding={addToCart.isPending && addToCart.variables?.id === product.id}
              onAdd={() => add(product)}
            />
          ))}
        </div>
      )}

      {cart.summary.units > 0 && (
        <CartPill units={cart.summary.units} subtotalPaise={cart.summary.subtotalPaise} onOpen={() => setCartOpen(true)} />
      )}

      {cartOpen && (
        <CartDrawer
          entries={cart.entries}
          summary={cart.summary}
          unavailableCount={cart.unavailableCount}
          busy={busy}
          onQuantity={changeQuantity}
          onRemove={remove}
          onClose={() => setCartOpen(false)}
        />
      )}
    </div>
  );
}
