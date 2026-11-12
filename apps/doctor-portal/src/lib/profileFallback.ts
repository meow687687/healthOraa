import type { PractitionerProfile } from "../types/profile";

// Offline demo profile, matching the seeded practitioner row.
export const FALLBACK_PRACTITIONER_PROFILE: PractitionerProfile = {
  id: "11111111-1111-1111-1111-111111111111",
  displayName: "Dr. Arishta Sharma",
  avatarUrl: null,
  email: null,
  phone: "9876543210",
  qualification: "MBBS, MD (General Medicine)",
  registrationNumber: "NMC-2018-99412",
  verificationStatus: "verified",
  bio: "",
  consultationFeeInr: 799,
  slotDurationMinutes: 30,
  languagesSpoken: ["English", "Hindi"],
  yearsOfExperience: 5,
  dataSource: "mock",
};
