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

// Keep compact navigation at the bottom on phones and move it above the page on wide screens.
export function PatientNav({ active, onSelect }: { active: PatientView; onSelect: (view: PatientView) => void }) {
  return (
    <nav
      aria-label="Patient navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-aura-line bg-aura-s1/95 backdrop-blur-md lg:static lg:flex lg:w-full lg:justify-center lg:border-t-0 lg:border-b lg:bg-aura-s1 lg:px-8 lg:py-2"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4 gap-1 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 lg:flex lg:w-full lg:max-w-5xl lg:justify-start lg:gap-2 lg:px-0 lg:py-0">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id} className="min-w-0">
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(id)}
                className={cn(
                  "flex min-h-[52px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue sm:text-[12px] lg:min-h-11 lg:w-auto lg:flex-row lg:justify-start lg:gap-2 lg:rounded-xl lg:px-4 lg:text-sm",
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
