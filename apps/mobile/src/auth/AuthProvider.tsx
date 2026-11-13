import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  // Why the last sign-in was refused or the account could not be loaded. Shown on the sign-in screen.
  notice: string | null;
}

export interface AuthApi extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  setNotice: (notice: string | null) => void;
}

const PATIENT_ONLY = 'This app is for patient accounts. Practitioners and admins use the web portals.';
const LOAD_FAILED = 'We could not load your account. Check your connection and try again.';

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, notice: null });

  useEffect(() => {
    let active = true;

    // A session only counts when its profile is a patient profile. Other roles are signed out at once.
    const resolve = async (session: Session | null) => {
      if (!session) {
        setState((prev) => ({ status: 'signed-out', session: null, notice: prev.notice }));
        return;
      }
      const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (!active) return;
      if (error || !data) {
        await supabase.auth.signOut();
        if (active) setState({ status: 'signed-out', session: null, notice: LOAD_FAILED });
        return;
      }
      if (data.role !== 'patient') {
        await supabase.auth.signOut();
        if (active) setState({ status: 'signed-out', session: null, notice: PATIENT_ONLY });
        return;
      }
      setState({ status: 'signed-in', session, notice: null });
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        // Same account, new token: keep the screens mounted and only swap the session.
        setState((prev) => (prev.status === 'signed-in' ? { ...prev, session } : prev));
        return;
      }
      setState((prev) => ({ ...prev, status: 'loading' }));
      void resolve(session);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      ...state,
      signIn: async (email, password) => {
        setState((prev) => ({ ...prev, notice: null }));
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (fullName, email, password) => {
        setState((prev) => ({ ...prev, notice: null }));
        // The database trigger creates a patient profile from full_name. The role is never taken from the client.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        return { needsConfirmation: data.session === null };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      setNotice: (notice) => setState((prev) => ({ ...prev, notice })),
    }),
    [state],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const api = useContext(AuthContext);
  if (!api) throw new Error('useAuth must be used inside AuthProvider');
  return api;
}
