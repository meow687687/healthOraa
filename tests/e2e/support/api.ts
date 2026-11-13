import { PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// Signs in a persona through the auth API and returns the access token. Used by API-level tests.
export const accessToken = async (persona: "doctor" | "patient" | "admin"): Promise<string> => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: `${persona}@healthoraa.com`, password: "HealthOraa@2026" }),
  });
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`Sign-in failed for ${persona}: ${response.status}`);
  return body.access_token;
};

// Calls PostgREST as the given user. Returns the HTTP status and the parsed body.
export const api = async (
  token: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON error bodies are returned as text.
  }
  return { status: response.status, body: parsed };
};

