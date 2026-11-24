import { spawnSync } from "node:child_process";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let localServiceRoleKey: string | undefined;

const getLocalServiceRoleKey = (): string => {
  if (localServiceRoleKey) return localServiceRoleKey;

  const result = spawnSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Unable to read local Supabase service role key: ${(result.stderr || result.stdout).trim()}`);
  }

  const line = result.stdout.split("\n").find((value) => value.startsWith("SERVICE_ROLE_KEY="));
  const key = line?.slice("SERVICE_ROLE_KEY=".length).trim().replace(/^['"]|['"]$/g, "");
  if (!key) throw new Error("Supabase status did not return a local service role key.");

  localServiceRoleKey = key;
  return key;
};

// Test fixtures use the Storage API for cleanup because Supabase blocks direct SQL deletes.
export const removeStorageObject = async (bucket: string, path: string): Promise<void> => {
  const objectPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "DELETE",
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${getLocalServiceRoleKey()}`,
    },
  });
  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`Storage fixture cleanup failed (${response.status}): ${await response.text()}`);
  }
};

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

export const deleteAccountFunctionReady = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
      body: "{}",
    });
    return response.status === 401;
  } catch {
    return false;
  }
};

// Calls PostgREST as the given user. Returns the HTTP status and the parsed body.
export const api = async (
  token: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
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

