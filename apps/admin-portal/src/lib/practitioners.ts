import { isSeededDemoPractitionerId } from "@healthoraa/types";

export function isSeededDemoPractitioner(
  practitionerId: string | null | undefined,
): boolean {
  return isSeededDemoPractitionerId(practitionerId);
}
