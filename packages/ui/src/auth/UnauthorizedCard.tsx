import { Badge } from "../Badge";
import { BTN_PRIMARY_BLOCK } from "../tokens";
import { AuthCard } from "./AuthCard";
import { ROLE_META, type DbRole } from "./roles";

export function UnauthorizedCard({
  portalLabel,
  requiredRole,
  email,
  role,
  problem,
  onSignOut,
}: {
  portalLabel: string;
  requiredRole: DbRole;
  email: string | null;
  role: DbRole | null;
  problem: string | null;
  onSignOut: () => Promise<void>;
}) {
  const needed = ROLE_META[requiredRole].label.toLowerCase();
  const subtitle =
    problem ??
    `${email ?? "This account"} is signed in as ${role ? ROLE_META[role].label.toLowerCase() : "an account without a role"}. The ${portalLabel} needs a ${needed} account.`;

  return (
    <AuthCard
      badge={<Badge tone="amber">Access restricted</Badge>}
      title={`The ${portalLabel} is not open to this account`}
      subtitle={subtitle}
    >
      <button type="button" onClick={() => void onSignOut()} className={BTN_PRIMARY_BLOCK}>
        Sign Out &amp; Switch Account
      </button>
    </AuthCard>
  );
}
