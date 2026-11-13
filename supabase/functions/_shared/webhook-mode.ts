const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "kong", "host.docker.internal"]);

// Unsigned mock payments are allowed only when no webhook secret is configured, the mock flag is
// on, and the database URL is a local host. A configured secret always requires a signature.
export function mockWebhookAllowed(env: {
  secret?: string;
  allowMock?: string;
  supabaseUrl?: string;
}): boolean {
  if (env.secret) return false;
  if (env.allowMock !== "true" || !env.supabaseUrl) return false;
  try {
    return LOCAL_HOSTS.has(new URL(env.supabaseUrl).hostname);
  } catch {
    return false;
  }
}
