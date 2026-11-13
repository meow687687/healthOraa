import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "../cn";

// One account control for every portal. Sign-out lives inside the menu.
export function AccountMenu({
  email,
  role,
  displayName,
  onSignOut,
}: {
  email: string;
  role: string;
  displayName?: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = (displayName ?? email).replace(/^Dr\.\s*/, "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-aura-line2 bg-aura-s2 py-1 pl-1 pr-3 transition-colors duration-150 hover:bg-aura-s3 cursor-pointer"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-accent-blue to-accent-violet text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-[13px] text-text-secondary md:inline">{role}</span>
        <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-aura-line2 bg-aura-s2 p-2 shadow-aura-elevated">
          <p className="px-3 pt-2 text-[13px] text-text-muted">Signed in as</p>
          <p className="truncate px-3 pb-3 font-mono text-[13px] text-text-primary">{email}</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
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
  );
}
