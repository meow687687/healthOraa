import { Constants } from "@healthoraa/types";
import type { ProgramCategory } from "@healthoraa/types";
import type { Tone } from "../ui/tokens";

export const PROGRAM_CATEGORIES: readonly ProgramCategory[] =
  Constants.public.Enums.program_category;

export const CATEGORY_META: Record<ProgramCategory, { label: string; tone: Tone }> = {
  weight_management: { label: "Weight Management", tone: "blue" },
  pcod_pcos: { label: "PCOD / PCOS", tone: "violet" },
  dermato_nutrition: { label: "Dermato-Nutrition", tone: "emerald" },
  custom: { label: "Custom", tone: "amber" },
};

// Two decimals always: shop prices and fees are NUMERIC(10,2) and must not round in finance views.
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatInr = (amount: number): string => inrFormatter.format(amount);
