// Client mock for the patient intake form. The schema has no intake table yet.
export interface IntakePreview {
  symptomsSince: string;
  allergies: string[];
  medicalHistory: string[];
  vitals: {
    bloodPressure: string;
    pulse: number;
    weightKg: number;
    temperatureC: number;
  };
}

const INTAKE_BY_CONSULTATION: Record<string, IntakePreview> = {
  "fb-consultation-001": {
    symptomsSince: "8 months, worse over the last 6 weeks",
    allergies: ["Sulfa drugs"],
    medicalHistory: ["PCOD diagnosed 2024", "No thyroid disorder on record"],
    vitals: { bloodPressure: "116/74", pulse: 82, weightKg: 64, temperatureC: 36.9 },
  },
  "fb-consultation-002": {
    symptomsSince: "5 months",
    allergies: ["None reported"],
    medicalHistory: ["Pre-diabetic range HbA1c (2025)"],
    vitals: { bloodPressure: "128/82", pulse: 76, weightKg: 92, temperatureC: 36.7 },
  },
  "fb-consultation-003": {
    symptomsSince: "Ongoing, reviewed every 3 months",
    allergies: ["Penicillin"],
    medicalHistory: ["Essential hypertension (2021)"],
    vitals: { bloodPressure: "138/88", pulse: 74, weightKg: 71, temperatureC: 36.8 },
  },
};

const DEFAULT_INTAKE: IntakePreview = {
  symptomsSince: "Not recorded",
  allergies: ["None reported"],
  medicalHistory: [],
  vitals: { bloodPressure: "—", pulse: 0, weightKg: 0, temperatureC: 0 },
};

export const intakeFor = (consultationId: string): IntakePreview =>
  INTAKE_BY_CONSULTATION[consultationId] ?? DEFAULT_INTAKE;
