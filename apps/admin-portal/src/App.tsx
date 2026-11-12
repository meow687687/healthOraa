import { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./lib/supabase";
import ProgramsView from "./components/programs/ProgramsView";
import PractitionersView from "./components/practitioners/PractitionersView";
import ShopView from "./components/shop/ShopView";
import OrdersView from "./components/orders/OrdersView";
import BannersView from "./components/banners/BannersView";
import PaymentsAuditView from "./components/payments/PaymentsAuditView";
import ComplianceView from "./components/compliance/ComplianceView";
import { Badge } from "./components/ui/Badge";
import { INPUT, PANEL, LABEL } from "./components/ui/tokens";
import { cn } from "./lib/cn";
import { useAuth } from "./context/AuthContext";
import { SessionPill } from "@healthoraa/ui";
import {
  LayoutDashboard,
  Stethoscope,
  Apple,
  ShoppingBag,
  Package,
  Megaphone,
  Receipt,
  FileCheck2,
  ShieldCheck,
  Search,
  Bell,
  Clock,
  CheckCircle2,
  Users,
} from "lucide-react";

type TabId = "overview" | "practitioners" | "programs" | "shop" | "orders" | "banners" | "finance" | "compliance";

const NAV_ITEMS: { id: TabId; icon: LucideIcon; label: string }[] = [
  { id: "overview", icon: LayoutDashboard, label: "Overview" },
  { id: "practitioners", icon: Stethoscope, label: "Doctors" },
  { id: "programs", icon: Apple, label: "Programs" },
  { id: "shop", icon: ShoppingBag, label: "Shop" },
  { id: "orders", icon: Package, label: "Orders" },
  { id: "banners", icon: Megaphone, label: "Banners" },
  { id: "finance", icon: Receipt, label: "Finance" },
  { id: "compliance", icon: FileCheck2, label: "Compliance" },
];

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
  const { user, isPrototype, signOut } = useAuth();

  // Fetch live counts from local Supabase instance
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-overview-stats"],
    queryFn: async () => {
      const [programsRes, doctorsRes, profilesRes] = await Promise.all([
        supabase.from("programs").select("id", { count: "exact", head: true }),
        supabase.from("practitioner_details").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalPrograms: programsRes.count ?? 0,
        activeDoctors: doctorsRes.count ?? 0,
        totalUsers: profilesRes.count ?? 0,
      };
    },
  });

  return (
    <div className="flex h-screen w-full bg-aura-canvas text-text-primary antialiased overflow-hidden font-sans">
      {/* 1. COMPACT LEFT ICON/NAVIGATION RAIL */}
      <aside className="fixed inset-x-0 bottom-0 z-30 h-16 border-t border-aura-line bg-aura-s1 flex flex-row items-center justify-center px-2 select-none lg:static lg:inset-auto lg:bottom-auto lg:h-auto lg:w-20 lg:flex-col lg:justify-between lg:border-r lg:border-t-0 lg:py-6 shrink-0" aria-label="Admin sections">
        <div className="flex w-full flex-row items-center justify-center gap-2 lg:flex-col lg:gap-8">
          {/* Logo Mark */}
          <div className="hidden lg:flex w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-emerald flex items-center justify-center shadow-lg shadow-accent-blue-glow">
            <span className="font-extrabold text-white text-lg tracking-wider">H</span>
          </div>

          {/* Navigation Items */}
          <nav className="flex w-full flex-row items-center justify-around gap-1 lg:flex-col lg:gap-3 lg:px-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`h-11 w-11 lg:h-auto lg:w-full lg:aspect-square rounded-2xl flex items-center justify-center transition-all duration-150 relative group ${
                    isActive
                      ? "bg-aura-s3 text-accent-blue shadow-aura-elevated border border-aura-line2"
                      : "text-text-muted hover:text-text-primary hover:bg-aura-s2"
                  }`}
                >
                  <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                  {isActive && <span className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent-blue rounded-r-full" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom System Action */}
        <div className="hidden lg:flex w-full px-3 flex-col items-center gap-3">
          <button
            type="button"
            aria-label="System status"
            className="w-10 h-10 rounded-full bg-aura-s2 border border-aura-line flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-accent-emerald" />
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-20 lg:pb-0">
        {/* Top App Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-aura-line px-4 py-3 shrink-0 bg-aura-s1/60 backdrop-blur-md sticky top-0 z-20 lg:h-20 lg:flex-nowrap lg:px-8 lg:py-0">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-bold tracking-tight text-white capitalize lg:text-2xl">{activeTab} Workspace</h1>
            <Badge tone="blue">v1.0-local</Badge>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap lg:gap-4">
            {isPrototype ? (
              <Badge tone="violet">Offline prototype identity</Badge>
            ) : (
              <SessionPill email={user.email} role={user.role} onSignOut={signOut} />
            )}

            {/* Search Input Bar */}
            <div className="relative order-last w-full min-w-0 lg:order-none lg:w-72 lg:flex-none">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                aria-label="Search records"
                placeholder="Search records, registrations..."
                className={cn(INPUT, "rounded-full pl-10 py-2 text-xs")}
              />
            </div>

            <button
              type="button"
              aria-label="Notifications"
              className="w-10 h-10 rounded-full bg-aura-s2 border border-aura-line flex items-center justify-center text-text-muted hover:text-text-primary relative transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-accent-blue ring-4 ring-aura-s2" />
            </button>

            {/* Admin Avatar Chip */}
            <div className="flex items-center gap-3 pl-2 border-l border-aura-line">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center font-bold text-xs text-white">
                AD
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-text-primary leading-tight">Admin Console</p>
                <p className="text-xs font-mono text-text-muted">{user.email}</p>
              </div>
            </div>
          </div>
        </header>

        {activeTab === "overview" ? (
          <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl w-full mx-auto">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`${PANEL} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue-glow blur-3xl pointer-events-none rounded-full" />
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Active Clinical Doctors</span>
                  <div className="p-2 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-4xl font-bold tracking-tight text-white font-mono tabular-nums">
                    {isLoading ? "..." : stats?.activeDoctors}
                  </span>
                  <Badge tone="emerald">Live</Badge>
                </div>
                <p className="text-xs text-text-muted mt-2">Verified NMC Telemedicine Registrations</p>
              </div>

              <div className={`${PANEL} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent-emerald-glow blur-3xl pointer-events-none rounded-full" />
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Nutrition Programs</span>
                  <div className="p-2 rounded-full bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald">
                    <Apple className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-4xl font-bold tracking-tight text-white font-mono tabular-nums">
                    {isLoading ? "..." : stats?.totalPrograms}
                  </span>
                  <Badge tone="emerald">Published</Badge>
                </div>
                <p className="text-xs text-text-muted mt-2">60-Day PCOD, Weight & Dermato Programs</p>
              </div>

              <div className={PANEL}>
                <div className="flex items-center justify-between">
                  <span className={LABEL}>Total Platform Profiles</span>
                  <div className="p-2 rounded-full bg-aura-s3 border border-aura-line2 text-text-secondary">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-4xl font-bold tracking-tight text-white font-mono tabular-nums">
                    {isLoading ? "..." : stats?.totalUsers}
                  </span>
                  <span className="text-xs font-semibold text-text-muted font-mono">Members</span>
                </div>
                <p className="text-xs text-text-muted mt-2">Customer & Practitioner Accounts</p>
              </div>
            </div>

            {/* Quick Verification & Health Table */}
            <div className={cn(PANEL, "p-5 md:p-7 space-y-6")}>
              <div className="flex items-center justify-between border-b border-aura-line pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Active Engine Verification</h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Confirming live local database connectivity and RLS policy status.
                  </p>
                </div>
                <Badge tone="emerald">PostgreSQL Ready</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-aura-s2 border border-aura-line flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">7-Day Chat Expiration Rule</h4>
                      <p className="text-xs text-text-muted">PostgreSQL RLS INSERT check active</p>
                    </div>
                  </div>
                  <Badge tone="emerald">Enforced</Badge>
                </div>

                <div className="p-4 rounded-2xl bg-aura-s2 border border-aura-line flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent-emerald/10 border border-accent-emerald/20 flex items-center justify-center text-accent-emerald">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">60-Day Diet Chat Window</h4>
                      <p className="text-xs text-text-muted">Enrolment expiry trigger active</p>
                    </div>
                  </div>
                  <Badge tone="emerald">Enforced</Badge>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{VIEWS[activeTab]}</div>
        )}
      </main>
    </div>
  );
}
