import { Badge, PANEL, cn } from "@healthoraa/ui";
import { useDoctor } from "../../context/DoctorContext";
import type { PractitionerProfile, VerificationStatus } from "../../types/profile";

const VERIFICATION: Record<VerificationStatus, { tone: "emerald" | "amber" | "red"; label: string }> = {
  verified: { tone: "emerald", label: "NMC verified" },
  pending: { tone: "amber", label: "NMC verification pending" },
  rejected: { tone: "red", label: "NMC verification rejected" },
};

// "Dr. Arishta Sharma" -> "AS"
const initialsOf = (name: string): string =>
  name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

export function ProfileHeaderCard({ profile }: { profile: PractitionerProfile }) {
  // Same state as the top bar toggle, so the two controls never disagree.
  const { isAccepting, toggleAccepting } = useDoctor();
  const verification = VERIFICATION[profile.verificationStatus];

  return (
    <section aria-label="Doctor profile" className={cn(PANEL, "flex flex-wrap items-center gap-5 md:flex-nowrap")}>
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-accent-blue to-accent-violet text-xl font-bold text-white ring-4 ring-aura-s2">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsOf(profile.displayName)
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-white">{profile.displayName}</h2>
        <p className="text-sm text-text-secondary">{profile.qualification}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={verification.tone}>{verification.label}</Badge>
          <span className="font-mono text-xs text-text-muted">{profile.registrationNumber}</span>
          {profile.dataSource === "mock" && <Badge tone="amber">Mock record</Badge>}
        </div>
        <p className="truncate font-mono text-xs text-text-muted">
          {profile.phone ?? "No phone on file"} · {profile.email ?? "Email not stored on profile"}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isAccepting}
        onClick={toggleAccepting}
        className="flex items-center gap-3 rounded-full border border-aura-line2 bg-aura-s2 py-2 pl-2 pr-4 transition-colors hover:bg-aura-s3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20"
      >
        <span
          aria-hidden="true"
          className={cn("relative h-5 w-9 rounded-full transition-colors", isAccepting ? "bg-accent-emerald" : "bg-aura-s3")}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
              isAccepting ? "left-[1.1rem]" : "left-0.5",
            )}
          />
        </span>
        <span className="text-xs font-semibold text-text-primary">
          {isAccepting ? "Accepting consultations" : "Consultations paused"}
        </span>
      </button>
    </section>
  );
}
