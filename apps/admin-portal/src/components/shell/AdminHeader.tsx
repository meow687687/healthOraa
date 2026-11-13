import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Search } from "lucide-react";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";

interface AdminHeaderProps {
  title: string;
  groupLabel: string;
  email: string;
  role: string;
  isPrototype: boolean;
  onSignOut: () => void;
  onOpenSearch: () => void;
}

export function AdminHeader({ title, groupLabel, email, role, isPrototype, onSignOut, onOpenSearch }: AdminHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Closes the account menu on a click outside it or on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-aura-line bg-aura-s1/90 px-4 backdrop-blur-md md:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="truncate text-[13px] text-text-muted">{groupLabel}</p>
        <h1 className="truncate text-lg font-semibold tracking-tight text-text-primary md:text-xl">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Jump to a section"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-aura-line2 bg-aura-s2 px-3 text-text-muted transition-colors duration-150 hover:text-text-primary cursor-pointer"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden text-[13px] lg:inline">Jump to</span>
          <kbd className="hidden rounded-md border border-aura-line2 px-1.5 font-mono text-[12px] lg:inline">Ctrl K</kbd>
        </button>

        {isPrototype ? <Badge tone="violet">Offline prototype</Badge> : null}

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-aura-line2 bg-aura-s2 py-1 pl-1 pr-3 transition-colors duration-150 hover:bg-aura-s3 cursor-pointer"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-accent-blue to-accent-violet text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-[13px] text-text-secondary md:inline">{role}</span>
            <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform duration-150", menuOpen && "rotate-180")} aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-aura-line2 bg-aura-s2 p-2 shadow-aura-elevated"
            >
              <p className="px-3 pt-2 text-[13px] text-text-muted">Signed in as</p>
              <p className="truncate px-3 pb-3 font-mono text-[13px] text-text-primary">{email}</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm text-text-secondary transition-colors duration-150 hover:bg-aura-s3 hover:text-text-primary cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
