import { Calendar, Stethoscope, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DoctorView = "queue" | "schedule" | "patients" | "profile";

const NAV_ITEMS: { id: DoctorView; label: string; icon: LucideIcon }[] = [
  { id: "queue", label: "Queue", icon: Stethoscope },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "patients", label: "Patients", icon: Users },
  { id: "profile", label: "Profile", icon: UserCheck },
];

// Vertical rail at lg and up. Becomes a fixed bottom bar below 1024px.
export function NavRail({ active, onSelect }: { active: DoctorView; onSelect: (view: DoctorView) => void }) {
  return (
    <aside
      aria-label="Doctor sections"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 shrink-0 select-none flex-row items-center justify-center border-t border-aura-line bg-aura-s1 px-2 lg:static lg:inset-auto lg:bottom-auto lg:h-auto lg:w-20 lg:flex-col lg:justify-between lg:border-r lg:border-t-0 lg:py-6"
    >
      <div className="flex w-full flex-row items-center justify-center gap-2 lg:flex-col lg:gap-8">
        <div
          aria-hidden="true"
          className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-blue to-accent-emerald shadow-lg shadow-accent-blue-glow lg:flex"
        >
          <span className="text-lg font-extrabold tracking-wider text-white">H</span>
        </div>

        <nav aria-label="Sections" className="flex w-full flex-row items-center justify-around gap-1 lg:flex-col lg:gap-3 lg:px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-150 lg:h-auto lg:w-full lg:aspect-square ${
                  isActive
                    ? "border border-aura-line2 bg-aura-s3 text-accent-blue shadow-aura-elevated"
                    : "text-text-muted hover:bg-aura-s2 hover:text-text-primary"
                }`}
              >
                <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                {isActive && (
                  <span className="absolute left-0 top-1/2 hidden h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent-blue lg:block" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
