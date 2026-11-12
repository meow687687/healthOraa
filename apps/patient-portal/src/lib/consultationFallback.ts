import type { ConsultationItem, DoctorOption } from "../types/consultations";

export const FALLBACK_DOCTORS: DoctorOption[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    displayName: "Dr. Arishta Sharma",
    qualification: "MBBS, MD (General Medicine)",
    registrationNumber: "NMC-2018-99412",
    feeInr: 799,
    slotDurationMinutes: 30,
    avatarUrl: null,
    dataSource: "mock",
  },
  {
    id: "fb-doctor-dermatology",
    displayName: "Dr. Neha Kapoor",
    qualification: "MBBS, MD (Dermatology)",
    registrationNumber: "NMC-2016-40221",
    feeInr: 1199,
    slotDurationMinutes: 30,
    avatarUrl: null,
    dataSource: "mock",
  },
];

// Demo history, dated relative to now, used only when the consultations query fails.
export const buildFallbackConsultations = (now: Date): ConsultationItem[] => {
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const plusMinutes = (iso: string) => new Date(new Date(iso).getTime() + 30 * 60_000).toISOString();
  const pastDate = daysAgo(19);
  const olderDate = daysAgo(47);

  return [
    {
      id: "fb-consult-001",
      state: "completed",
      doctorName: "Dr. Arishta Sharma",
      startsAt: pastDate,
      endsAt: plusMinutes(pastDate),
      chiefComplaint: "Cystic acne on the jaw and irregular cycles",
      reference: "HLX-FB0001",
      prescription: {
        id: "fb-rx-001",
        doctorName: "Dr. Arishta Sharma",
        issuedAt: pastDate,
        diagnosis: "PCOD with hormonal acne, Grade I",
        followupDays: 14,
        medicines: [
          { name: "Metformin 500mg", dosage: "1 tablet", frequency: "Twice daily after meals", durationDays: 90, instructions: "Take with food" },
          { name: "Adapalene 0.1% gel", dosage: "Pea-sized amount", frequency: "Once daily at night", durationDays: 60, instructions: "Apply after moisturiser" },
        ],
      },
    },
    {
      id: "fb-consult-002",
      state: "completed",
      doctorName: "Dr. Neha Kapoor",
      startsAt: olderDate,
      endsAt: plusMinutes(olderDate),
      chiefComplaint: "Dry, itchy patches behind the knees",
      reference: "HLX-FB0002",
      prescription: null,
    },
  ];
};
