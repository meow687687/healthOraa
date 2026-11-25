export const SEEDED_DEMO_PRACTITIONER_ID =
  "11111111-1111-1111-1111-111111111111";

export function isSeededDemoPractitionerId(
  practitionerId: string | null | undefined,
): boolean {
  return practitionerId === SEEDED_DEMO_PRACTITIONER_ID;
}
