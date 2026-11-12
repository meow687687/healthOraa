import type { LucideIcon } from "lucide-react";
import { Leaf, Pill, Scale, Sparkles } from "lucide-react";
import type { ProductCategory } from "../types/shop";

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  supplements: "Supplements",
  ayurvedic: "Ayurvedic",
  skincare: "Skincare",
  equipment: "Equipment",
};

// Products have no photo in the catalogue, so each category gets a tinted tile with its own icon.
export const CATEGORY_VISUAL: Record<ProductCategory, { icon: LucideIcon; tile: string }> = {
  supplements: { icon: Pill, tile: "from-accent-blue/25 to-accent-violet/10 text-accent-blue" },
  ayurvedic: { icon: Leaf, tile: "from-accent-emerald/25 to-accent-emerald/5 text-accent-emerald" },
  skincare: { icon: Sparkles, tile: "from-accent-violet/25 to-accent-red/10 text-accent-violet" },
  equipment: { icon: Scale, tile: "from-accent-amber/20 to-aura-s3 text-accent-amber" },
};
