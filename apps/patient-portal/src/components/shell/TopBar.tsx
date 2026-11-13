import { AccountMenu, Badge } from "@healthoraa/ui";
import { useAuth } from "../../context/AuthContext";
import { usePatient } from "../../context/PatientContext";
import { useActiveProgram } from "../../hooks/useActiveProgram";

// "Priya Mehta" -> "PM"
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

export function TopBar() {
  const patient = usePatient();
  const { user, isPrototype, signOut } = useAuth();
  const program = useActiveProgram();
  const status = program.data?.program;

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-aura-line bg-aura-s1/90 px-4 py-3 backdrop-blur-md md:px-8 lg:h-20 lg:flex-nowrap lg:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent-emerald to-accent-blue text-xs font-bold text-white">
          {initialsOf(patient.displayName)}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-muted">Welcome back</p>
          <h1 className="truncate text-base font-bold tracking-tight text-white lg:text-lg">{patient.displayName}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status && (
          <Badge tone="emerald">
            {status.protocolLabel} • Day {status.currentDay}/{status.durationDays}
          </Badge>
        )}
        {isPrototype ? (
          <span className="hidden md:inline-flex">
            <Badge tone="violet">Offline prototype identity</Badge>
          </span>
        ) : (
          <AccountMenu email={user.email} role={user.role} displayName={patient.displayName} onSignOut={() => void signOut()} />
        )}
      </div>
    </header>
  );
}
