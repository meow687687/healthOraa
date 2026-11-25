import { Constants, PROGRAM_CATEGORY_LABELS } from "@healthoraa/types";
import type { ProgramCategory } from "@healthoraa/types";
import type { Tone } from "../ui/tokens";

export const PROGRAM_CATEGORIES: readonly ProgramCategory[] =
  Constants.public.Enums.program_category;

export const CATEGORY_META: Record<ProgramCategory, { label: string; tone: Tone }> = {
  weight_management: { label: PROGRAM_CATEGORY_LABELS.weight_management, tone: "blue" },
  pcod_pcos: { label: PROGRAM_CATEGORY_LABELS.pcod_pcos, tone: "violet" },
  dermato_nutrition: { label: PROGRAM_CATEGORY_LABELS.dermato_nutrition, tone: "emerald" },
  custom: { label: PROGRAM_CATEGORY_LABELS.custom, tone: "amber" },
};

// Two decimals always: shop prices and fees are NUMERIC(10,2) and must not round in finance views.
const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatInr = (amount: number): string => inrFormatter.format(amount);
