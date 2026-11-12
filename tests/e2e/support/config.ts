// Local stack and personas. Every value matches `supabase status` and the seed data.
export const SUPABASE_URL = "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export const PORTALS = {
  admin: "http://127.0.0.1:5180/",
  doctor: "http://127.0.0.1:5190/",
  patient: "http://127.0.0.1:5200/",
} as const;

export const PERSONAS = {
  admin: { button: "Sign in as Demo Admin", id: "00000000-0000-4000-8000-00000000ad31" },
  doctor: { button: "Sign in as Dr. Arishta", id: "11111111-1111-1111-1111-111111111111" },
  patient: { button: "Sign in as Demo Patient", id: "22222222-2222-2222-2222-222222222222" },
} as const;

// Marks every row this suite creates, so reruns can clean up and never touch seeded data.
export const CHIEF_COMPLAINT_PREFIX = "E2E lifecycle";
export const PROGRAM_TITLE = "30-Day Gut Reset";
