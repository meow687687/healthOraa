import { cn } from "../cn";
import { BTN_TEXT } from "../tokens";
import { ROLE_META, type DbRole } from "./roles";

// Live header identity: who is signed in, their role, and a sign-out control.
export function SessionPill({
  email,
  role,
  onSignOut,
}: {
  email: string;
  role: DbRole;
  onSignOut: () => Promise<void>;
}) {
  const meta = ROLE_META[role];
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full border border-aura-line2 bg-aura-s2 py-1 pl-3 pr-1">
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
      <span className="min-w-0 truncate font-mono text-xs text-text-secondary" title={email}>
        {email}
      </span>
      <span className="hidden text-xs text-text-muted xl:inline">{meta.label}</span>
      <button type="button" onClick={() => void onSignOut()} className={cn(BTN_TEXT, "shrink-0")}>
        Sign Out
      </button>
    </div>
  );
}
