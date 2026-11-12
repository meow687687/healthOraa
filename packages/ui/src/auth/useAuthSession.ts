import { useCallback, useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@healthoraa/types";
import type { DbRole } from "./roles";

export interface AuthUser {
  id: string;
  email: string;
  role: DbRole;
  fullName: string;
}

// "bypass" means Supabase auth is switched off and the portal uses its offline dev identity.
export type AuthStatus = "bypass" | "loading" | "signed-out" | "unauthorized" | "authorized";

export interface AuthSession {
  status: AuthStatus;
  // Set once the profile has loaded, even when its role does not match the portal.
  user: AuthUser | null;
  email: string | null;
  // Explains a failed role check that is not simply the wrong role.
  problem: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

interface ProfileState {
  userId: string;
  role: DbRole | null;
  fullName: string | null;
  error: string | null;
}

// Keeps the Supabase session and checks profiles.role against the portal's required role.
export function useAuthSession(
  client: SupabaseClient<Database>,
  options: { enabled: boolean; requiredRole: DbRole },
): AuthSession {
  const { enabled, requiredRole } = options;
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!enabled) return;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [client, enabled]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    client
      .from("profiles")
      .select("role, full_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setProfile({
          userId,
          role: data?.role ?? null,
          fullName: data?.full_name ?? null,
          error: error?.message ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client, userId]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (!error) return null;
      return error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message;
    },
    [client],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await client.auth.signOut();
  }, [client]);

  const email = session?.user.email ?? null;
  const base = { signIn, signOut, email };

  if (!enabled) return { ...base, status: "bypass", user: null, problem: null };
  if (!sessionReady) return { ...base, status: "loading", user: null, problem: null };
  if (!userId) return { ...base, status: "signed-out", user: null, problem: null };

  const current = profile?.userId === userId ? profile : null;
  if (!current) return { ...base, status: "loading", user: null, problem: null };
  if (current.error) {
    return { ...base, status: "unauthorized", user: null, problem: `We could not confirm your role (${current.error}).` };
  }
  if (!current.role) {
    return { ...base, status: "unauthorized", user: null, problem: "This account has no profile yet." };
  }

  const user: AuthUser = {
    id: userId,
    email: email ?? "",
    role: current.role,
    fullName: current.fullName ?? "",
  };
  return {
    ...base,
    status: current.role === requiredRole ? "authorized" : "unauthorized",
    user,
    problem: null,
  };
}
