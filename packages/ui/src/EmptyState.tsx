import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { BTN_PRIMARY, PANEL } from "./tokens";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action: { label: string; onClick: () => void };
  className?: string;
}

// Structured empty state: a subtle icon badge, one headline, and the primary action pill.
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(PANEL, "flex flex-col items-center gap-3 py-12 text-center", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-aura-line bg-aura-s2 text-text-secondary">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description && <p className="max-w-sm text-xs text-text-muted">{description}</p>}
      <button type="button" onClick={action.onClick} className={cn(BTN_PRIMARY, "mt-1 px-5 py-2")}>
        {action.label}
      </button>
    </div>
  );
}
