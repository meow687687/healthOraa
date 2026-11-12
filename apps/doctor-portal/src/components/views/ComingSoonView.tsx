import type { LucideIcon } from "lucide-react";
import { PANEL, cn } from "@healthoraa/ui";

// Placeholder for sections whose data flow is not built yet.
export default function ComingSoonView({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <section className={cn(PANEL, "flex flex-col items-center gap-3 py-16 text-center")}>
      <div className="rounded-full border border-aura-line2 bg-aura-s3 p-3 text-text-secondary">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
      <p className="max-w-sm text-xs text-text-muted">{description}</p>
    </section>
  );
}
