import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../cn";

export interface PortalNavItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

export interface PortalNavGroup<T extends string> {
  id: string;
  // Null for a group without a heading.
  title: string | null;
  items: PortalNavItem<T>[];
}

interface PortalRailProps<T extends string> {
  groups: PortalNavGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
  // Shown at the foot of the labelled rail.
  footer?: ReactNode;
  // Items on the phone bar. When there are more than four items in total, the rest sit under More.
  phonePrimary?: T[];
}

// Three layouts from one list: a labelled rail (xl), an icon rail with tooltips (md to xl), and a bottom bar (phones).
export function PortalRail<T extends string>({ groups, active, onSelect, footer, phonePrimary }: PortalRailProps<T>) {
  const [moreOpen, setMoreOpen] = useState(false);
  // The icon tooltip sits outside the scrolling rail, so it is never clipped.
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const all = groups.flatMap((group) => group.items);
  const bar = all.length <= 4 ? all : all.filter((item) => (phonePrimary ?? all.slice(0, 3).map((i) => i.id)).includes(item.id));
  const overflow = all.length <= 4 ? [] : all.filter((item) => !bar.includes(item));

  // Opening moves focus into the sheet. Closing, by any route, returns focus to the More button.
  useEffect(() => {
    if (!moreOpen) return;
    sheet.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      moreButton.current?.focus();
    };
  }, [moreOpen]);

  // Tab and Shift+Tab cycle inside the sheet, so the page behind it cannot take focus.
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !sheet.current) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>("button"));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const choose = (id: T) => {
    onSelect(id);
    setMoreOpen(false);
  };

  return (
    <>
      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-aura-line bg-aura-s1 px-3 py-5 xl:flex"
      >
        <Brand />
        <nav className="mt-8 flex-1 space-y-6 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.id}>
              {group.title ? <p className="px-3 pb-2 text-[13px] font-semibold text-text-muted">{group.title}</p> : null}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NavButton item={item} active={active === item.id} onSelect={choose} layout="wide" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        {footer ? <div className="mt-4 px-3 text-[13px] text-text-muted">{footer}</div> : null}
      </aside>

      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center gap-6 border-r border-aura-line bg-aura-s1 py-5 md:flex xl:hidden"
      >
        <Brand compact />
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto">
          {all.map((item) => (
            <NavButton key={item.id} item={item} active={active === item.id} onSelect={choose} layout="icon" onHint={setTip} />
          ))}
        </nav>
      </aside>

      <nav
        aria-label="Main navigation"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 items-stretch border-t border-aura-line bg-aura-s1 px-1 md:hidden",
          "grid h-16",
        )}
        style={{ gridTemplateColumns: `repeat(${bar.length + (overflow.length ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {bar.map((item) => (
          <NavButton key={item.id} item={item} active={active === item.id} onSelect={choose} layout="bar" />
        ))}
        {overflow.length > 0 ? (
          <button
            ref={moreButton}
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-label="More sections"
            className={cn(
              "flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold cursor-pointer",
              moreOpen || overflow.some((item) => item.id === active) ? "text-text-primary" : "text-text-muted",
            )}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        ) : null}
      </nav>

      {tip ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-aura-line2 bg-aura-s3 px-2.5 py-1.5 text-[13px] text-text-primary shadow-aura-elevated md:block xl:hidden"
          style={{ top: tip.top, left: tip.left }}
        >
          {tip.label}
        </div>
      ) : null}

      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" onMouseDown={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={sheet}
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            onKeyDown={trapFocus}
            onMouseDown={(event) => event.stopPropagation()}
            className="absolute inset-x-3 bottom-20 rounded-3xl border border-aura-line bg-aura-s1 p-4 shadow-aura-card"
          >
            {groups.map((group) => (
              <div key={group.id} className="mb-4 last:mb-0">
                {group.title ? <p className="px-2 pb-2 text-[13px] font-semibold text-text-muted">{group.title}</p> : null}
                <ul className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <NavButton item={item} active={active === item.id} onSelect={choose} layout="wide" />
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

const FOCUS = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20";

function NavButton<T extends string>({
  item,
  active,
  onSelect,
  layout,
  onHint,
}: {
  item: PortalNavItem<T>;
  active: boolean;
  onSelect: (id: T) => void;
  layout: "wide" | "icon" | "bar";
  onHint?: (tip: { label: string; top: number; left: number } | null) => void;
}) {
  const Icon = item.icon;
  const stateClass = active ? "bg-aura-s3 text-text-primary shadow-aura-elevated" : "text-text-muted hover:bg-aura-s2 hover:text-text-primary";
  if (layout === "wide") {
    return (
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={active ? "page" : undefined}
        className={cn("flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-3 transition-colors duration-150 cursor-pointer", FOCUS, stateClass)}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium">{item.label}</span>
      </button>
    );
  }
  if (layout === "bar") {
    return (
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className={cn("flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-colors duration-150 cursor-pointer", FOCUS, stateClass)}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="max-w-full truncate text-[11px] font-semibold">{item.label}</span>
      </button>
    );
  }
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    onHint?.({ label: item.label, top: rect.top + rect.height / 2, left: rect.right + 12 });
  };
  const hide = () => onHint?.(null);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={hide}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={hide}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn("flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-150 cursor-pointer", FOCUS, stateClass)}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
    </button>
  );
}
