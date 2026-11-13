import { useEffect, useState } from "react";
import { Menu, Shield } from "lucide-react";
import { cn } from "../../lib/cn";
import { NAV_GROUPS, findNav, type NavItem, type TabId } from "./navConfig";

// Phone bottom bar: three most used sections, then More for the rest. Five slots fit a 375px screen.
const PHONE_PRIMARY: TabId[] = ["overview", "orders", "practitioners"];

interface AdminRailProps {
  active: TabId;
  onSelect: (id: TabId) => void;
}

export function AdminRail({ active, onSelect }: AdminRailProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const phonePrimary = PHONE_PRIMARY.map((id) => findNav(id).item);
  const activeGroup = findNav(active).group.id;

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const choose = (id: TabId) => {
    onSelect(id);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Wide screens: labelled rail with group headings. */}
      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-aura-line bg-aura-s1 px-3 py-5 xl:flex"
      >
        <Brand />
        <nav className="mt-8 flex-1 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.id}>
              {group.title ? (
                <p className="px-3 pb-2 text-[13px] font-semibold text-text-muted">{group.title}</p>
              ) : null}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavButton item={item} active={active === item.id} onSelect={choose} showLabel />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-4 flex items-center gap-2 px-3 text-[13px] text-text-muted">
          <Shield className="h-4 w-4 text-accent-emerald" aria-hidden="true" />
          Admin access only
        </div>
      </aside>

      {/* Tablets: icon rail. Each icon shows its name on hover and on keyboard focus. */}
      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center gap-6 border-r border-aura-line bg-aura-s1 py-5 md:flex xl:hidden"
      >
        <Brand compact />
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto">
          {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
            <NavButton key={item.id} item={item} active={active === item.id} onSelect={choose} />
          ))}
        </nav>
      </aside>

      {/* Phones: bottom bar. */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-4 items-stretch border-t border-aura-line bg-aura-s1 px-1 md:hidden"
      >
        {phonePrimary.map((item) => (
          <NavButton key={item.id} item={item} active={active === item.id} onSelect={choose} showLabel compactLabel />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-label="More sections"
          className={cn(
            "flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold cursor-pointer",
            moreOpen || (!PHONE_PRIMARY.includes(active) && activeGroup) ? "text-text-primary" : "text-text-muted",
          )}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          More
        </button>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" onMouseDown={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            onMouseDown={(event) => event.stopPropagation()}
            className="absolute inset-x-3 bottom-20 rounded-3xl border border-aura-line bg-aura-s1 p-4 shadow-aura-card"
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.id} className="mb-4 last:mb-0">
                {group.title ? <p className="px-2 pb-2 text-[13px] font-semibold text-text-muted">{group.title}</p> : null}
                <ul className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <NavButton item={item} active={active === item.id} onSelect={choose} showLabel />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "justify-center" : "px-2")}>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-blue to-accent-emerald shadow-lg">
        <span className="text-base font-extrabold text-white">H</span>
      </div>
      {compact ? null : <span className="text-[15px] font-semibold text-text-primary">Healthoraa</span>}
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
  showLabel = false,
  compactLabel = false,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (id: TabId) => void;
  showLabel?: boolean;
  compactLabel?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "group relative flex min-h-[44px] items-center transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20",
        compactLabel ? "min-w-0 flex-col justify-center gap-1 rounded-2xl px-1" : showLabel ? "w-full gap-3 rounded-2xl px-3" : "h-11 w-11 justify-center rounded-2xl",
        active
          ? "bg-aura-s3 text-text-primary shadow-aura-elevated"
          : "text-text-muted hover:bg-aura-s2 hover:text-text-primary",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {showLabel ? <span className={cn("truncate text-sm font-medium", compactLabel && "max-w-full text-[11px] font-semibold")}>{item.label}</span> : null}
      {!showLabel ? (
        <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-aura-line2 bg-aura-s3 px-2.5 py-1.5 text-[13px] text-text-primary shadow-aura-elevated group-hover:block group-focus-visible:block">
          {item.label}
        </span>
      ) : null}
    </button>
  );
}
