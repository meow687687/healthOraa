import type { PatientIntakeInput } from "@healthoraa/validation";

export interface DoctorOption {
  id: string;
  displayName: string;
  qualification: string;
  feeInr: number;
  slotDurationMinutes: number;
  avatarUrl: string | null;
  dataSource: "live" | "mock";
}

export interface SlotOption {
  id: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  source: "live" | "mock";
}

export interface RxMedicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string | null;
}

export interface PrescriptionRecord {
  id: string;
  doctorName: string;
  issuedAt: string;
  diagnosis: string;
  followupDays: number;
  medicines: RxMedicine[];
}

// awaiting_payment: sent to the clinic, payment not yet verified.
// held_on_device: could not be sent, kept in this browser only.
export type ConsultationState = "awaiting_payment" | "confirmed" | "held_on_device" | "completed" | "cancelled";

export interface ConsultationItem {
  id: string;
  state: ConsultationState;
  doctorName: string;
  startsAt: string;
  endsAt: string;
  chiefComplaint: string | null;
  reference: string;
  prescription: PrescriptionRecord | null;
  // Set when the consultation completes. The follow-up chat is open until this time.
  followupExpiresAt: string | null;
}

export interface DeviceBooking {
  reference: string;
  slotId: string;
  doctorId: string;
  doctorName: string;
  startsAt: string;
  endsAt: string;
  totalPaise: number;
  chiefComplaint: string;
  intake: PatientIntakeInput;
  createdAt: string;
}

export interface BookingRequest {
  doctor: DoctorOption;
  slot: SlotOption;
  intake: PatientIntakeInput;
}

export interface BookingReceipt {
  reference: string;
  state: "awaiting_payment" | "held_on_device";
  doctorName: string;
  startsAt: string;
  endsAt: string;
  feePaise: number;
  gstPaise: number;
  totalPaise: number;
  // Why the booking is not confirmed with the clinic, or null when it is.
  notice: string | null;
}
