import type { ConsultationStatus } from "./queue";

export interface PatientMedicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string | null;
}

export interface PatientVisit {
  id: string;
  date: string;
  status: ConsultationStatus;
  chiefComplaint: string | null;
  diagnosis: string | null;
  notes: string | null;
}

export interface PatientPrescription {
  id: string;
  visitId: string;
  signedAt: string;
  diagnosis: string;
  followupDays: number;
  medicines: PatientMedicine[];
}

export interface LabReport {
  id: string;
  title: string;
  kind: "pdf" | "image";
  collectedOn: string;
  summary: string;
  fileName: string;
  sizeKb: number;
}

export interface PatientIntake {
  chiefComplaint: string;
  symptomsSince: string | null;
  medicalHistory: string[];
  // Null for live patients: the database does not store intake vitals yet.
  vitals: {
    bloodPressure: string;
    pulse: number;
    weightKg: number;
    heightCm: number;
    bmi: number;
  } | null;
}

// One patient as the doctor sees them. Fields the database does not store are null or empty
// for live patients, and filled in only by the mock records.
export interface PatientRecord {
  id: string;
  name: string;
  age: number | null;
  sex: "Female" | "Male" | null;
  bloodGroup: string | null;
  phone: string | null;
  emergencyContact: { name: string; relation: string; phone: string } | null;
  conditions: string[];
  allergies: string[];
  drugAlerts: string[];
  latestIntake: PatientIntake | null;
  visits: PatientVisit[];
  prescriptions: PatientPrescription[];
  labReports: LabReport[];
  dataSource: "live" | "mock";
}
