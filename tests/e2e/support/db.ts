import { spawnSync } from "node:child_process";

// The local Postgres container from `supabase start`. Assertions read the database directly,
// the same way a second service would, so they check what was persisted, not what the UI shows.
const CONTAINER = "supabase_db_healthOraa";

export const psql = (query: string): string => {
  const result = spawnSync(
    "docker",
    ["exec", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", query],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`psql failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
};

export const script = (sql: string): void => {
  const result = spawnSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`psql script failed: ${(result.stderr || result.stdout).trim()}`);
};

// Quotes a value for use inside a SQL string literal. Only used for test-controlled values.
export const lit = (value: string): string => `'${value.replace(/'/g, "''")}'`;
