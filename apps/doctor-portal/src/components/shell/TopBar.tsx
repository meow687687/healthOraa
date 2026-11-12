import { Badge, SessionPill } from "@healthoraa/ui";
import { useAuth } from "../../context/AuthContext";
import { useDoctor } from "../../context/DoctorContext";

// "Dr. Arishta Sharma, MD" -> "AS"
const initialsOf = (displayName: string): string =>
  displayName
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

export function TopBar() {
  const { doctor, isAccepting, toggleAccepting } = useDoctor();
  const { user, isPrototype, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-aura-line bg-aura-s1/60 px-4 py-3 backdrop-blur-md lg:h-20 lg:flex-nowrap lg:px-8 lg:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent-blue to-accent-violet text-xs font-bold text-white">
          {initialsOf(doctor.displayName)}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-white lg:text-xl">{doctor.displayName}</h1>
          <p className="truncate font-mono text-xs text-text-muted">{doctor.registrationNumber}</p>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap">
        <button
          type="button"
          onClick={toggleAccepting}
          aria-pressed={isAccepting}
          title="Toggle whether new consultations can be booked"
          className="rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20"
        >
          <Badge tone={isAccepting ? "emerald" : "neutral"}>
            {isAccepting ? "Accepting Consultations" : "Consultations Paused"}
          </Badge>
        </button>
        {isPrototype ? (
          <div className="hidden md:block">
            <Badge tone="violet">Offline prototype identity</Badge>
          </div>
        ) : (
          <SessionPill email={user.email} role={user.role} onSignOut={signOut} />
        )}
      </div>
    </header>
  );
}
