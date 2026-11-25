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
  const { user, isPrototype, isDemoData, signOut } = useAuth();
  const program = useActiveProgram();
  const status = program.data?.program;

  return (
    <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-aura-line bg-aura-s1/90 px-4 py-3 backdrop-blur-md min-[520px]:grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_auto] md:px-8 lg:h-20 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-s3 text-xs font-bold text-text-primary">
          {initialsOf(patient.displayName)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-muted">
            Healthoraa · Patient
          </p>
          <p className="truncate text-base font-bold tracking-tight text-white md:overflow-visible md:text-clip md:whitespace-normal lg:text-lg">
            {patient.displayName}
          </p>
        </div>
      </div>

      <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-2 min-[520px]:col-span-1 min-[520px]:col-start-2 min-[520px]:row-start-auto md:col-span-2 md:col-start-1 md:row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-auto">
        {status && (
          <Badge tone="emerald" className="text-xs">
            <span aria-hidden="true" className="sm:hidden">
              Day {status.currentDay}/{status.durationDays}
            </span>
            <span className="hidden sm:inline">
              {status.protocolLabel} • Day {status.currentDay}/
              {status.durationDays}
            </span>
            <span className="sr-only sm:hidden">
              {status.protocolLabel}, day {status.currentDay} of{" "}
              {status.durationDays}
            </span>
          </Badge>
        )}
        {isDemoData ? (
          <Badge tone="violet" className="text-xs">
            <span aria-hidden="true" className="sm:hidden">
              Demo
            </span>
            <span className="hidden sm:inline">
              Demo data · synthetic records
            </span>
            <span className="sr-only sm:hidden">
              Demo data · synthetic records
            </span>
          </Badge>
        ) : null}
      </div>

      {!isPrototype ? (
        <div className="col-start-2 row-start-1 min-[520px]:col-start-3 min-[520px]:row-start-auto md:col-start-2 md:row-start-1 lg:col-start-3 lg:row-start-auto">
          <AccountMenu
            email={user.email}
            role={user.role}
            displayName={patient.displayName}
            onSignOut={() => void signOut()}
          />
        </div>
      ) : null}
    </header>
  );
}
