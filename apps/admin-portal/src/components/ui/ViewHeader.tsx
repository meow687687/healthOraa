import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { PANEL, TONE_CLASS, type Tone } from "./tokens";

// Summary card at the top of every admin view.
export function ViewHeader({
  icon: Icon,
  tone,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn(PANEL, "flex flex-wrap items-center justify-between gap-4")}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn("p-3 rounded-full border", TONE_CLASS[tone])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
