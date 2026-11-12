import type { LucideIcon } from "lucide-react";
import { Apple, FileText, ShoppingBag, Stethoscope } from "lucide-react";
import { cn } from "@healthoraa/ui";

export type PatientView = "programs" | "consultations" | "shop" | "locker";

const ITEMS: { id: PatientView; label: string; icon: LucideIcon }[] = [
  { id: "programs", label: "Programs", icon: Apple },
  { id: "consultations", label: "Consultations", icon: Stethoscope },
  { id: "shop", label: "Shop", icon: ShoppingBag },
  { id: "locker", label: "Health Locker", icon: FileText },
];

// Floating pill rail at the bottom of every breakpoint, within easy thumb reach on phones.
// Inactive labels stay available to screen readers and show on wider screens.
export function PatientNav({ active, onSelect }: { active: PatientView; onSelect: (view: PatientView) => void }) {
  return (
    <nav aria-label="Patient navigation" className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-aura-line2 bg-aura-s1/95 p-1.5 shadow-aura-elevated backdrop-blur-md">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(id)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20",
                  isActive ? "bg-aura-s3 text-white" : "text-text-muted hover:text-text-primary",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={isActive ? undefined : "sr-only sm:not-sr-only"}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
