import { PROGRAM_CATEGORY_LABELS } from "@healthoraa/types";
import type { ProgramCategory } from "@healthoraa/types";
import { Apple, Droplets, HeartPulse, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const PROGRAM_CATEGORY_META: Record<
  ProgramCategory,
  { label: string; icon: LucideIcon; tile: string }
> = {
  weight_management: {
    label: PROGRAM_CATEGORY_LABELS.weight_management,
    icon: Apple,
    tile: "bg-aura-s3 text-accent-blue",
  },
  pcod_pcos: {
    label: PROGRAM_CATEGORY_LABELS.pcod_pcos,
    icon: HeartPulse,
    tile: "bg-aura-s3 text-accent-violet",
  },
  dermato_nutrition: {
    label: PROGRAM_CATEGORY_LABELS.dermato_nutrition,
    icon: Sparkles,
    tile: "bg-aura-s3 text-accent-emerald",
  },
  custom: {
    label: PROGRAM_CATEGORY_LABELS.custom,
    icon: Droplets,
    tile: "bg-aura-s3 text-accent-amber",
  },
};
