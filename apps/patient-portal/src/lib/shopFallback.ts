import type { ShopProduct } from "../types/shop";

const SAMPLE_DESCRIPTION = "Sample listing. Client-approved product information is pending.";

export const FALLBACK_PRODUCTS: ShopProduct[] = [
  {
    id: "fb-HX-ASH-KSM66",
    title: "Sample Ayurvedic listing",
    category: "ayurvedic",
    description: SAMPLE_DESCRIPTION,
  },
  {
    id: "fb-HX-CER-BAR",
    title: "Sample skincare listing",
    category: "skincare",
    description: SAMPLE_DESCRIPTION,
  },
  {
    id: "fb-HX-OMG-3T",
    title: "Sample supplement listing",
    category: "supplements",
    description: SAMPLE_DESCRIPTION,
  },
  {
    id: "fb-HX-VITD-K2",
    title: "Sample supplement listing 2",
    category: "supplements",
    description: SAMPLE_DESCRIPTION,
  },
  {
    id: "fb-HX-NIA-SER",
    title: "Sample skincare listing 2",
    category: "skincare",
    description: SAMPLE_DESCRIPTION,
  },
  {
    id: "fb-HX-PRO-GUT",
    title: "Sample supplement listing 3",
    category: "supplements",
    description: SAMPLE_DESCRIPTION,
  },
];
