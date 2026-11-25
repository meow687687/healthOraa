import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { SkeletonBlock, SkipLink } from "@healthoraa/ui";
import { OverviewView } from "./components/overview/OverviewView";
import { AdminHeader } from "./components/shell/AdminHeader";
import { AdminRail } from "./components/shell/AdminRail";
import { CommandPalette } from "./components/shell/CommandPalette";
import { findNav, type TabId } from "./components/shell/navConfig";
import { useAuth } from "./context/AuthContext";
import { cn } from "./lib/cn";

type PortalView = LazyExoticComponent<ComponentType>;

const VIEWS: Record<Exclude<TabId, "overview">, PortalView> = {
  practitioners: lazy(
    () => import("./components/practitioners/PractitionersView"),
  ),
  programs: lazy(() => import("./components/programs/ProgramsView")),
  shop: lazy(() => import("./components/shop/ShopView")),
  orders: lazy(() => import("./components/orders/OrdersView")),
  banners: lazy(() => import("./components/banners/BannersView")),
  finance: lazy(() => import("./components/payments/PaymentsAuditView")),
  compliance: lazy(() => import("./components/compliance/ComplianceView")),
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isPending, startTransition] = useTransition();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mainContentRef = useRef<HTMLElement>(null);
  const shouldFocusMainAfterTabChange = useRef(false);
  const { user, isDemoData, signOut } = useAuth();
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

  useEffect(() => {
    if (!shouldFocusMainAfterTabChange.current) return;

    shouldFocusMainAfterTabChange.current = false;
    mainContentRef.current?.focus();
  }, [activeTab]);

  const select = (id: TabId) => {
    shouldFocusMainAfterTabChange.current = id !== activeTab;
    startTransition(() => setActiveTab(id));
    setPaletteOpen(false);
  };

  return (
    <div className="min-h-screen bg-aura-canvas font-sans text-text-primary antialiased">
      <SkipLink />
      <AdminRail active={activeTab} onSelect={select} />

      <div className="flex min-h-screen min-w-0 flex-col md:pl-16 xl:pl-[232px]">
        <AdminHeader
          title={item.label}
          groupLabel={group.title ?? "Overview"}
          email={user.email}
          role={user.role}
          isDemoData={isDemoData}
          onSignOut={() => void signOut()}
          onOpenSearch={() => setPaletteOpen(true)}
        />

        <main
          ref={mainContentRef}
          id="main-content"
          tabIndex={-1}
          aria-label={`${item.label} content`}
          aria-busy={isPending}
          className={cn(
            "flex-1 p-4 pb-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-blue md:p-6 md:pb-8 lg:p-8",
          )}
        >
          <div
            key={activeTab}
            className="portal-view-enter mx-auto w-full max-w-7xl"
          >
            {activeTab === "overview" ? (
              <OverviewView onNavigate={select} />
            ) : (
              <Suspense
                fallback={
                  <div
                    aria-busy="true"
                    aria-label={`Loading ${item.label}`}
                    className="space-y-5"
                  >
                    <SkeletonBlock className="h-8 w-48" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <SkeletonBlock className="h-36" />
                      <SkeletonBlock className="h-36" />
                    </div>
                    <SkeletonBlock className="h-56" />
                  </div>
                }
              >
                {(() => {
                  const View = VIEWS[activeTab];
                  return <View />;
                })()}
              </Suspense>
            )}
          </div>
        </main>
      </div>

      {paletteOpen ? (
        <CommandPalette
          open
          onClose={() => setPaletteOpen(false)}
          onSelect={select}
        />
      ) : null}
    </div>
  );
}
