import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutOrderSchema } from "@healthoraa/validation";
import type { CheckoutOrderInput } from "@healthoraa/validation";
import { BTN_PRIMARY, Drawer, DrawerHeader, ERROR_BOX, LABEL } from "@healthoraa/ui";
import { usePlaceOrder } from "../../hooks/usePatientShop";
import type { CartSummary } from "../../lib/cartMath";
import type { CartEntry, OrderConfirmation, ShopProduct } from "../../types/shop";
import { CartLineItem } from "./cart/CartLineItem";
import { ShippingForm } from "./cart/ShippingForm";
import { PriceBreakdown } from "./cart/PriceBreakdown";
import { OrderSuccess } from "./cart/OrderSuccess";

export function CartDrawer({
  entries,
  summary,
  unavailableCount,
  busy,
  onQuantity,
  onRemove,
  onClose,
}: {
  entries: CartEntry[];
  summary: CartSummary;
  unavailableCount: number;
  busy: boolean;
  onQuantity: (product: ShopProduct, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClose: () => void;
}) {
  const placeOrder = usePlaceOrder();
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const form = useForm<CheckoutOrderInput>({
    resolver: zodResolver(checkoutOrderSchema),
    mode: "onTouched",
    defaultValues: { full_name: "", phone: "", pincode: "", address_line: "", city: "", state: "" },
  });

  const onSubmit = async (values: CheckoutOrderInput) => {
    try {
      setConfirmation(await placeOrder.mutateAsync({ entries, checkout: values }));
    } catch {
      // Shown above the button; the address stays filled in for a retry.
    }
  };

  const canPlace = entries.length > 0 && unavailableCount === 0 && !placeOrder.isPending;

  return (
    <Drawer isOpen onClose={onClose} labelledBy="cart-title" className="max-w-2xl p-6 md:p-8">
      <DrawerHeader
        eyebrow="Wellness shop"
        title={confirmation ? "Order confirmed" : "Your cart and checkout"}
        titleId="cart-title"
        onClose={onClose}
      />

      <div className="flex-1 space-y-8 py-6">
        {confirmation ? (
          <OrderSuccess confirmation={confirmation} onDone={onClose} />
        ) : (
          <>
            <section aria-labelledby="items-title" className="space-y-3">
              <p id="items-title" className={LABEL}>
                Items
              </p>
              {entries.length === 0 ? (
                <p className="rounded-2xl border border-aura-line bg-aura-s2 px-4 py-6 text-center text-sm text-text-muted">
                  Your cart is empty.
                </p>
              ) : (
                <ul className="space-y-3">
                  {entries.map((entry) => (
                    <CartLineItem
                      key={entry.productId}
                      entry={entry}
                      busy={busy}
                      onQuantity={onQuantity}
                      onRemove={onRemove}
                    />
                  ))}
                </ul>
              )}
              {unavailableCount > 0 && (
                <p className="text-xs text-accent-amber">Remove the unavailable item to place this order.</p>
              )}
            </section>

            <form id="checkout-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
              <ShippingForm form={form} />
            </form>

            <PriceBreakdown summary={summary} />

            {placeOrder.isError && <div className={ERROR_BOX}>{placeOrder.error.message}</div>}

            <div className="space-y-3 border-t border-aura-line pt-5">
              <p className="text-xs text-text-muted">
                Mock payment. No money is charged in this prototype, and the order payment is not verified.
              </p>
              <div className="flex justify-end">
                <button type="submit" form="checkout-form" disabled={!canPlace} className={BTN_PRIMARY}>
                  {placeOrder.isPending ? "Processing mock payment..." : "Place Order (Mock Payment)"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
