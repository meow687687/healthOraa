import type { Database } from "@healthoraa/types";

export type DbRole = Database["public"]["Enums"]["user_role"];

// One-click sign-in shown on the login card in development builds only.
export interface DevPersona {
  label: string;
  email: string;
  password: string;
}

export const ROLE_META: Record<DbRole, { label: string; dot: string }> = {
  admin: { label: "Admin", dot: "bg-accent-violet" },
  practitioner: { label: "Practitioner", dot: "bg-accent-emerald" },
  patient: { label: "Patient", dot: "bg-accent-blue" },
};
