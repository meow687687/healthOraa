import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Platform, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { allowPushTokenRegistration, clearPushToken } from '../lib/notifications';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'profile-error';

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
  retryProfile: () => void;
  setNotice: (notice: string | null) => void;
}

const PATIENT_ONLY = 'This app is for patient accounts. Practitioners and admins use the web portals.';
const LOAD_FAILED = 'We could not verify your patient account. Check your connection and try again.';

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, notice: null });
  const retryProfileRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    let requestId = 0;

    // A session only reaches the app after its profile is verified as a patient profile.
    const resolve = async (session: Session | null) => {
      const currentRequestId = ++requestId;
      if (!session) {
        setState((prev) => ({ status: 'signed-out', session: null, notice: prev.notice }));
        return;
      }
      setState((prev) => ({ ...prev, status: 'loading', session, notice: null }));
      const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (!active || currentRequestId !== requestId) return;
      if (error || !data) {
        // Keep the auth session and offer a retry. A temporary profile query failure is not a sign-out.
        setState({ status: 'profile-error', session, notice: LOAD_FAILED });
        return;
      }
      if (data.role !== 'patient') {
        try {
          await clearPushToken(session.user.id);
        } catch {
          if (!active || currentRequestId !== requestId) return;
          setState({
            status: 'profile-error',
            session,
            notice: 'We could not safely disconnect notifications for this account. Check your connection and try again.',
          });
          return;
        }
        if (!active || currentRequestId !== requestId) return;
        setState((prev) => ({ ...prev, notice: PATIENT_ONLY }));
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError && active && currentRequestId === requestId) {
          setState({ status: 'profile-error', session, notice: 'Sign out failed. Retry account check or try signing out again.' });
        }
        return;
      }
      allowPushTokenRegistration(session.user.id);
      setState({ status: 'signed-in', session, notice: null });
    };

    retryProfileRef.current = () => {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState((prev) => ({ ...prev, status: 'profile-error', notice: LOAD_FAILED }));
          return;
        }
        void resolve(data.session);
      });
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        // Keep signed-in screens mounted when only the access token rotates.
        setState((prev) => prev.status === 'signed-in' && prev.session?.user.id === session.user.id
          ? { ...prev, session }
          : prev);
        return;
      }
      // Every other auth event supersedes the in-flight profile lookup.
      setState((prev) => ({ ...prev, status: session ? 'loading' : 'signed-out', session }));
      void resolve(session);
    });

    return () => {
      active = false;
      requestId += 1;
      retryProfileRef.current = null;
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
        const userId = state.session?.user.id;
        if (userId) {
          try {
            await clearPushToken(userId);
          } catch {
            // Keep the session active until the backend can no longer send pushes to this device.
            throw new Error('We could not safely disconnect this device from notifications. Check your connection and try again.');
          }
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      retryProfile: () => retryProfileRef.current?.(),
      setNotice: (notice) => setState((prev) => ({ ...prev, notice })),
    }),
    [state],
  );

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#101515' }}>
        <Text accessibilityRole="header" style={{ color: '#f2f6f4', fontSize: 24, fontWeight: '700' }}>
          Healthoraa is a mobile app
        </Text>
        <Text style={{ marginTop: 12, color: '#b4c1bd', fontSize: 16, lineHeight: 24 }}>
          Patient sign-in is available in the iOS and Android apps. This browser build cannot access patient accounts.
        </Text>
      </View>
    );
  }

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const api = useContext(AuthContext);
  if (!api) throw new Error('useAuth must be used inside AuthProvider');
  return api;
}
