import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { ALL_NAV_ITEMS, type TabId } from "./navConfig";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: TabId) => void;
}

// Jumps to a section from the keyboard. Record search is a later step.
export function CommandPalette({ open, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ALL_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(needle));
  }, [query]);

  // Escape closes from anywhere in the palette. Focus returns to whatever opened it.
  // The opener is recorded before the search field takes focus, so close can return to it.
  const opener = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open, onClose]);

  // Keeps the highlighted result in view when the arrow keys move past the visible list.
  useEffect(() => {
    if (!open || !matches[index]) return;
    document.getElementById(`jump-${matches[index].id}`)?.scrollIntoView({ block: "nearest" });
  }, [index, matches, open]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((current) => Math.min(current + 1, matches.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && matches[index]) onSelect(matches[index].id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a section"
        // Tab stays on the search field, so focus cannot leave the palette while it is open.
        onKeyDown={(event) => {
          if (event.key === "Tab") event.preventDefault();
        }}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-aura-line2 bg-aura-s1 shadow-aura-card">
        <div className="flex items-center gap-3 border-b border-aura-line px-4">
          <Search className="h-4 w-4 text-text-muted" aria-hidden="true" />
          <input
            ref={field}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="jump-results"
            aria-activedescendant={matches[index] ? `jump-${matches[index].id}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a section"
            className="h-14 flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <ul id="jump-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {matches.map((item, position) => (
            <li
              key={item.id}
              id={`jump-${item.id}`}
              role="option"
              aria-selected={position === index}
              onMouseEnter={() => setIndex(position)}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl px-3 text-sm",
                position === index ? "bg-aura-s3 text-text-primary" : "text-text-secondary",
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </li>
          ))}
          {matches.length === 0 ? <li className="px-3 py-4 text-sm text-text-muted">No section matches.</li> : null}
        </ul>
      </div>
    </div>
  );
}
