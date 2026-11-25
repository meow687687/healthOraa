import type { Enums } from "@healthoraa/types";

export type ProductCategory = Enums<"product_category">;

export interface ShopProduct {
  id: string;
  title: string;
  category: ProductCategory;
  description: string;
}
