import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";
import { LABEL } from "./tokens";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  // Appended after the default hull classes, so width and padding can be overridden per drawer.
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD = "input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled])";

// Shared slide-out hull for every form drawer and detail drawer.
// Owns Escape-to-close, focus entry/trap/restore, and body scroll lock.
export function Drawer({ isOpen, onClose, labelledBy, children, className }: DrawerProps) {
  const asideRef = useRef<HTMLElement>(null);
  // Keep the latest onClose without re-running the focus effect on every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = (): HTMLElement[] =>
      Array.from(asideRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    // Wait one frame so the aside is no longer inert/translated before focusing.
    const frame = requestAnimationFrame(() => {
      const field = asideRef.current?.querySelector<HTMLElement>(FIELD);
      (field ?? focusables()[0])?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !asideRef.current?.contains(active);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [isOpen]);

  return (
    <div
      inert={!isOpen}
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-200",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => onCloseRef.current()} />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-lg bg-aura-s1 border-l border-aura-line p-8 shadow-2xl flex flex-col justify-between overflow-y-auto transition-transform duration-[250ms]",
          isOpen ? "translate-x-0" : "translate-x-full",
          className,
        )}
      >
        {children}
      </aside>
    </div>
  );
}

interface DrawerHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  titleId: string;
  onClose: () => void;
  children?: ReactNode;
}

export function DrawerHeader({ eyebrow, title, titleId, onClose, children }: DrawerHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 pb-6 border-b border-aura-line">
      <div className="min-w-0 space-y-2">
        {eyebrow && <p className={LABEL}>{eyebrow}</p>}
        <h2 id={titleId} className="text-lg font-bold text-white tracking-tight break-words">
          {title}
        </h2>
        {children}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close drawer"
        className="shrink-0 w-9 h-9 rounded-full bg-aura-s2 border border-aura-line flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </header>
  );
}
