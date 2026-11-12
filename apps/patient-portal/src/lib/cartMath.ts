import { gstOn, rupeesToPaise } from "./money";
import type { ShopProduct } from "../types/shop";

export interface CartSummary {
  units: number;
  subtotalPaise: number;
  deliveryPaise: number;
  gstPaise: number;
  totalPaise: number;
}

// Subtotal, free standard delivery, and 18% platform GST on the subtotal. Amounts stay in paise.
export const summariseCart = (entries: { product: ShopProduct; quantity: number }[]): CartSummary => {
  const subtotalPaise = entries.reduce((sum, entry) => sum + rupeesToPaise(entry.product.priceInr) * entry.quantity, 0);
  const gstPaise = gstOn(subtotalPaise);
  return {
    units: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    subtotalPaise,
    deliveryPaise: 0,
    gstPaise,
    totalPaise: subtotalPaise + gstPaise,
  };
};

export const trackingIdFor = (orderId: string): string => `HX-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
