import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ROW_PILL, ROW_REVEAL } from "./tokens";

// Floating action pill. Place inside a `group` row (tr or article).
export function RowActions({
  active = false,
  className,
  children,
}: {
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(ROW_REVEAL, active && "opacity-100", className)}>
      <div className={ROW_PILL}>{children}</div>
    </div>
  );
}
