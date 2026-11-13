import {
  Apple,
  FileCheck2,
  LayoutDashboard,
  Megaphone,
  Package,
  Receipt,
  ShoppingBag,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export type TabId = "overview" | "practitioners" | "programs" | "shop" | "orders" | "banners" | "finance" | "compliance";

export interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  title: string | null;
  items: NavItem[];
}

// Grouped by the work an operator does. Overview has no group heading.
export const NAV_GROUPS: NavGroup[] = [
  { id: "home", title: null, items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }] },
  {
    id: "operations",
    title: "Operations",
    items: [
      { id: "practitioners", label: "Doctors", icon: Stethoscope },
      { id: "orders", label: "Orders", icon: Package },
      { id: "compliance", label: "Compliance", icon: FileCheck2 },
    ],
  },
  {
    id: "catalogue",
    title: "Catalogue",
    items: [
      { id: "programs", label: "Programs", icon: Apple },
      { id: "shop", label: "Shop", icon: ShoppingBag },
      { id: "banners", label: "Banners", icon: Megaphone },
    ],
  },
  { id: "finance", title: "Finance", items: [{ id: "finance", label: "Payments", icon: Receipt }] },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const findNav = (id: TabId): { item: NavItem; group: NavGroup } => {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.id === id);
    if (item) return { item, group };
  }
  return { item: ALL_NAV_ITEMS[0], group: NAV_GROUPS[0] };
};
