export type VerificationStatus = "pending" | "verified" | "rejected";

// The doctor's own profile as the Profile tab shows it.
export interface PractitionerProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  // Email lives in auth.users, which the anon client cannot read, so it is null for live profiles.
  email: string | null;
  phone: string | null;
  qualification: string;
  registrationNumber: string;
  verificationStatus: VerificationStatus;
  bio: string;
  consultationFeeInr: number;
  slotDurationMinutes: number;
  languagesSpoken: string[];
  yearsOfExperience: number | null;
  dataSource: "live" | "mock";
}
