/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

// Registration details for the dev doctor. Name and id come from the signed-in session.
export interface DoctorProfile {
  id: string;
  displayName: string;
  qualification: string;
  registrationNumber: string | null;
  consultationFeeInr: number;
  slotDurationMinutes: number;
}

export const DEV_DOCTOR: DoctorProfile = {
  id: "11111111-1111-1111-1111-111111111111",
  displayName: "Dr. Arishta Sharma, MD",
  qualification: "MBBS, Dermatology",
  registrationNumber: "NMC-DEMO-001",
  consultationFeeInr: 799,
  slotDurationMinutes: 30,
};

interface DoctorContextValue {
  doctor: DoctorProfile;
  isAccepting: boolean;
  toggleAccepting: () => void;
  activeConsultationId: string | null;
  setActiveConsultationId: (id: string | null) => void;
}

const DoctorContext = createContext<DoctorContextValue | null>(null);

export function DoctorProvider({ children }: { children: ReactNode }) {
  const { user, isPrototype } = useAuth();
  const [isAccepting, setIsAccepting] = useState(true);
  const [activeConsultationId, setActiveConsultationId] = useState<
    string | null
  >(null);

  const toggleAccepting = useCallback(
    () => setIsAccepting((prev) => !prev),
    [],
  );

  const doctor = useMemo<DoctorProfile>(
    () => ({
      ...DEV_DOCTOR,
      id: user.id,
      displayName: isPrototype ? DEV_DOCTOR.displayName : user.fullName,
      qualification: isPrototype ? DEV_DOCTOR.qualification : "",
      registrationNumber: isPrototype ? DEV_DOCTOR.registrationNumber : null,
    }),
    [user, isPrototype],
  );

  const value = useMemo<DoctorContextValue>(
    () => ({
      doctor,
      isAccepting,
      toggleAccepting,
      activeConsultationId,
      setActiveConsultationId,
    }),
    [doctor, isAccepting, toggleAccepting, activeConsultationId],
  );

  return (
    <DoctorContext.Provider value={value}>{children}</DoctorContext.Provider>
  );
}

export function useDoctor(): DoctorContextValue {
  const ctx = useContext(DoctorContext);
  if (!ctx) throw new Error("useDoctor must be used inside DoctorProvider");
  return ctx;
}
