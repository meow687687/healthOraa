import { useEffect, useState, type ReactNode } from "react";
import ProgramsView from "./components/programs/ProgramsView";
import PractitionersView from "./components/practitioners/PractitionersView";
import ShopView from "./components/shop/ShopView";
import OrdersView from "./components/orders/OrdersView";
import BannersView from "./components/banners/BannersView";
import PaymentsAuditView from "./components/payments/PaymentsAuditView";
import ComplianceView from "./components/compliance/ComplianceView";
import { OverviewView } from "./components/overview/OverviewView";
import { AdminHeader } from "./components/shell/AdminHeader";
import { AdminRail } from "./components/shell/AdminRail";
import { CommandPalette } from "./components/shell/CommandPalette";
import { findNav, type TabId } from "./components/shell/navConfig";
import { useAuth } from "./context/AuthContext";
import { cn } from "./lib/cn";

const VIEWS: Record<Exclude<TabId, "overview">, ReactNode> = {
  practitioners: <PractitionersView />,
  programs: <ProgramsView />,
  shop: <ShopView />,
  orders: <OrdersView />,
  banners: <BannersView />,
  finance: <PaymentsAuditView />,
  compliance: <ComplianceView />,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { user, isPrototype, signOut } = useAuth();
  const { item, group } = findNav(activeTab);

  // Ctrl K (or Cmd K) opens the section search from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = (id: TabId) => {
    setActiveTab(id);
    setPaletteOpen(false);
  };

  return (
    <div className="min-h-screen bg-aura-canvas font-sans text-text-primary antialiased">
      <AdminRail active={activeTab} onSelect={select} />

      <div className="flex min-h-screen min-w-0 flex-col md:pl-16 xl:pl-[232px]">
        <AdminHeader
          title={item.label}
          groupLabel={group.title ?? "Overview"}
          email={user.email}
          role={user.role}
          isPrototype={isPrototype}
          onSignOut={() => void signOut()}
          onOpenSearch={() => setPaletteOpen(true)}
        />

        <main className={cn("flex-1 p-4 pb-24 md:p-6 md:pb-8 lg:p-8")}>
          <div className="mx-auto w-full max-w-7xl">
            {activeTab === "overview" ? <OverviewView onNavigate={select} /> : VIEWS[activeTab]}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSelect={select} />
    </div>
  );
}
