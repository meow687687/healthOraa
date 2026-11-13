import { gstOn } from '../../lib/money';

export interface CartProduct {
  id: string;
  title: string;
  price_inr: number;
  stock_count: number;
}

export interface CartLine {
  product: CartProduct;
  quantity: number;
  linePaise: number;
}

// Pairs the cart quantities with the products on sale. Lines whose product is no longer listed are left out.
export function buildLines(quantities: Record<string, number>, products: CartProduct[]): CartLine[] {
  return products
    .filter((product) => (quantities[product.id] ?? 0) > 0)
    .map((product) => {
      const quantity = quantities[product.id] ?? 0;
      const unitPaise = Math.round(Number(product.price_inr) * 100);
      return { product, quantity, linePaise: unitPaise * quantity };
    });
}

// Delivery is free across India. GST is 18% of the subtotal.
export function summarise(lines: CartLine[]) {
  const subtotalPaise = lines.reduce((sum, line) => sum + line.linePaise, 0);
  const gstPaise = gstOn(subtotalPaise);
  return {
    units: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalPaise,
    gstPaise,
    totalPaise: subtotalPaise + gstPaise,
  };
}
