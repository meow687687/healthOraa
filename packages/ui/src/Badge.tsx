import type { ReactNode } from "react";
import { cn } from "./cn";
import { PILL, TONE_CLASS, type Tone } from "./tokens";

export function Badge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn(PILL, TONE_CLASS[tone], className)}>
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
