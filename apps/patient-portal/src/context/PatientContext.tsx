import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

// Identity for the signed-in patient, taken from the Supabase session.
export interface PatientIdentity {
  id: string;
  displayName: string;
}

const PatientContext = createContext<PatientIdentity | null>(null);

export function PatientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const value = useMemo<PatientIdentity>(() => ({ id: user.id, displayName: user.fullName }), [user]);
  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient(): PatientIdentity {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used inside PatientProvider");
  return ctx;
}
