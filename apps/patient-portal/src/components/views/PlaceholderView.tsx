import type { LucideIcon } from "lucide-react";
import { PANEL, cn } from "@healthoraa/ui";

// Stands in for tabs whose screens are not built yet.
export function PlaceholderView({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <section className={cn(PANEL, "flex flex-col items-center gap-4 py-16 text-center")}>
      <div className="rounded-full border border-accent-blue/20 bg-accent-blue/10 p-3 text-accent-blue">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
      <p className="max-w-md text-sm text-text-secondary">{description}</p>
    </section>
  );
}
