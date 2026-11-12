import type { BannerTargetType } from "@healthoraa/types";
import type { Tone } from "../ui/tokens";

export const BANNER_TARGET_META: Record<BannerTargetType, { label: string; tone: Tone }> = {
  program: { label: "Program", tone: "emerald" },
  doctor: { label: "Doctor", tone: "blue" },
  shop_product: { label: "Shop Product", tone: "violet" },
  external_url: { label: "External URL", tone: "amber" },
};
