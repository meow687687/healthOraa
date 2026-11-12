import type { ProductCategory } from "@healthoraa/types";
import type { Tone } from "../ui/tokens";

export const PRODUCT_CATEGORY_META: Record<ProductCategory, { label: string; tone: Tone }> = {
  supplements: { label: "Supplements", tone: "blue" },
  ayurvedic: { label: "Ayurvedic", tone: "emerald" },
  skincare: { label: "Skincare", tone: "violet" },
  equipment: { label: "Equipment", tone: "amber" },
};

export const LOW_STOCK_THRESHOLD = 5;
