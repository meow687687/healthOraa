import type { Database } from "@healthoraa/types";

export type ConsultationStatus = Database["public"]["Enums"]["consultation_status"];

// View model for one row of the consultation queue. Age, gender and chief complaint
// are not stored on the consultations table yet, so live rows leave them null.
export interface QueueConsultation {
  id: string;
  patientName: string;
  age: number | null;
  gender: string | null;
  chiefComplaint: string | null;
  slotStart: string;
  slotEnd: string;
  status: ConsultationStatus;
  // Null until the consultation completes. Then it is slot end plus 7 days.
  followupExpiresAt: string | null;
}
