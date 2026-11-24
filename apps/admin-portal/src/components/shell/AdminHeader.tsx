import { Search } from "lucide-react";
import { AccountMenu } from "@healthoraa/ui";
import { Badge } from "../ui/Badge";

interface AdminHeaderProps {
  title: string;
  groupLabel: string;
  email: string;
  role: string;
  isDemoData: boolean;
  onSignOut: () => void;
  onOpenSearch: () => void;
}

export function AdminHeader({ title, groupLabel, email, role, isDemoData, onSignOut, onOpenSearch }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-2 border-b border-aura-line bg-aura-s1/90 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-4 md:px-6 lg:px-8">
      <div className="min-w-0 flex-1">
        <p className="hidden truncate text-[13px] text-text-muted sm:block">{groupLabel}</p>
        <h1 className="truncate break-normal text-sm font-semibold tracking-tight text-text-primary sm:text-lg md:text-xl">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Jump to a section"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-aura-line2 bg-aura-s2 px-2.5 text-text-muted transition-colors duration-150 hover:text-text-primary cursor-pointer sm:px-3"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden text-[13px] lg:inline">Jump to</span>
          <kbd className="hidden rounded-md border border-aura-line2 px-1.5 font-mono text-[12px] lg:inline">Ctrl K</kbd>
        </button>

        {isDemoData ? (
          <Badge tone="violet" className="text-xs">
            <span className="sm:hidden">Demo · synthetic</span>
            <span className="hidden sm:inline">Demo data · synthetic records</span>
            <span className="sr-only sm:hidden">Demo data · synthetic records</span>
          </Badge>
        ) : null}

        <AccountMenu email={email} role={role} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
