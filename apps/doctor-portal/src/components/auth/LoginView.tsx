import { LoginCard } from "@healthoraa/ui";
import type { DevPersona } from "@healthoraa/ui";

// One-click persona only in development builds, so the shared password never ships to production.
const PERSONAS: DevPersona[] = [
  { label: "Sign in as Dr. Arishta", email: "doctor@healthoraa.com", password: "HealthOraa@2026" },
];

export default function LoginView({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<string | null> }) {
  return <LoginCard portalLabel="Practitioner Suite" personas={import.meta.env.DEV ? PERSONAS : []} onSignIn={onSignIn} />;
}
