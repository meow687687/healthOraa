import type { LucideIcon } from "lucide-react";
import { Leaf, Pill, Scale, Sparkles } from "lucide-react";
import type { ProductCategory } from "../types/shop";

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  supplements: "Supplements",
  ayurvedic: "Ayurvedic",
  skincare: "Skincare",
  equipment: "Equipment",
};

// Products have no approved photo in the catalogue, so each category uses a neutral illustration.
export const CATEGORY_VISUAL: Record<ProductCategory, { icon: LucideIcon; tile: string }> = {
  supplements: { icon: Pill, tile: "bg-aura-s2 text-accent-blue" },
  ayurvedic: { icon: Leaf, tile: "bg-aura-s2 text-accent-emerald" },
  skincare: { icon: Sparkles, tile: "bg-aura-s2 text-accent-violet" },
  equipment: { icon: Scale, tile: "bg-aura-s2 text-accent-amber" },
};
