import type { Enums } from "./database.types";

export const PROGRAM_CATEGORY_LABELS: Record<
  Enums<"program_category">,
  string
> = {
  weight_management: "Weight Management",
  pcod_pcos: "PCOD / PCOS",
  dermato_nutrition: "Dermato-Nutrition",
  custom: "Personalized Nutrition",
};
