import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { AuthSplash, UnauthorizedCard, useAuthSession } from "@healthoraa/ui";
import type { AuthSession, AuthUser } from "@healthoraa/ui";
import { supabase } from "../lib/supabase";
import LoginView from "../components/auth/LoginView";

// Supabase sign-in is on unless VITE_AUTH_ENABLED=false, which keeps the offline prototype identity.
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false";

const PROTOTYPE_USER: AuthUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "patient@healthoraa.com",
  role: "patient",
  fullName: "Priya Mehta",
};

interface AuthValue {
  user: AuthUser;
  isPrototype: boolean;
  signOut: AuthSession["signOut"];
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useAuthSession(supabase, { enabled: AUTH_ENABLED, requiredRole: "patient" });
  const isPrototype = session.status === "bypass";
  const user = isPrototype ? PROTOTYPE_USER : session.status === "authorized" ? session.user : null;

  if (!user) {
    if (session.status === "loading") return <AuthSplash label="Checking your session..." />;
    if (session.status === "unauthorized") {
      return (
        <UnauthorizedCard
          portalLabel="Patient Portal"
          requiredRole="patient"
          email={session.email}
          role={session.user?.role ?? null}
          problem={session.problem}
          onSignOut={session.signOut}
        />
      );
    }
    return <LoginView onSignIn={session.signIn} />;
  }

  return (
    <AuthContext.Provider value={{ user, isPrototype, signOut: session.signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
