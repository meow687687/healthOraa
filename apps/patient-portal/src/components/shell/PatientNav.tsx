import type { LucideIcon } from "lucide-react";
import { Apple, FileText, ShoppingBag, Stethoscope } from "lucide-react";
import { cn } from "@healthoraa/ui";

export type PatientView = "today" | "consultations" | "shop" | "locker";

const ITEMS: { id: PatientView; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Today", icon: Apple },
  { id: "consultations", label: "Consultations", icon: Stethoscope },
  { id: "shop", label: "Shop", icon: ShoppingBag },
  { id: "locker", label: "Health Locker", icon: FileText },
];

// One fixed bar at the bottom on every screen size. Labels always show, so no tab depends on a guess.
export function PatientNav({ active, onSelect }: { active: PatientView; onSelect: (view: PatientView) => void }) {
  return (
    <nav aria-label="Patient navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-aura-line bg-aura-s1/95 backdrop-blur-md">
      <ul className="mx-auto grid max-w-xl grid-cols-4 gap-1 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id} className="min-w-0">
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(id)}
                className={cn(
                  "flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold sm:text-[12px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20",
                  isActive ? "bg-aura-s3 text-text-primary" : "text-text-muted hover:text-text-primary",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
