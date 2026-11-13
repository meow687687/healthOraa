import { cn } from "./cn";
import { SKELETON } from "./tokens";

// Placeholder shown while a query loads. Keeps the layout still and marks the region busy for screen readers.
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn(SKELETON, className)} />;
}
