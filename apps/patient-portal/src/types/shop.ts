import type { Enums } from "@healthoraa/types";

export type ProductCategory = Enums<"product_category">;

export interface ShopProduct {
  id: string;
  sku: string;
  title: string;
  category: ProductCategory;
  description: string;
  priceInr: number;
  stock: number;
  dataSource: "live" | "demo";
}

// The cart as stored: product id and quantity only. Product details come from the catalogue.
export interface StoredCartLine {
  productId: string;
  quantity: number;
}

// A cart line joined to its product. product is null when the item is no longer in the catalogue.
export interface CartEntry {
  productId: string;
  product: ShopProduct | null;
  quantity: number;
}

export interface OrderConfirmation {
  orderId: string;
  trackingId: string;
  units: number;
  totalPaise: number;
}
