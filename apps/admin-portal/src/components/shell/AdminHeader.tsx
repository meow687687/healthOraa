import { Search } from "lucide-react";
import { AccountMenu } from "@healthoraa/ui";
import { Badge } from "../ui/Badge";

interface AdminHeaderProps {
  title: string;
  groupLabel: string;
  email: string;
  role: string;
  isPrototype: boolean;
  onSignOut: () => void;
  onOpenSearch: () => void;
}

export function AdminHeader({ title, groupLabel, email, role, isPrototype, onSignOut, onOpenSearch }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-aura-line bg-aura-s1/90 px-4 backdrop-blur-md md:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="truncate text-[13px] text-text-muted">{groupLabel}</p>
        <h1 className="truncate text-lg font-semibold tracking-tight text-text-primary md:text-xl">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Jump to a section"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-aura-line2 bg-aura-s2 px-3 text-text-muted transition-colors duration-150 hover:text-text-primary cursor-pointer"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden text-[13px] lg:inline">Jump to</span>
          <kbd className="hidden rounded-md border border-aura-line2 px-1.5 font-mono text-[12px] lg:inline">Ctrl K</kbd>
        </button>

        {isPrototype ? <Badge tone="violet">Offline prototype</Badge> : null}

        <AccountMenu email={email} role={role} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
