import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { webhookReady } from "./support/webhook";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

// The razorpay-webhook Edge Function runs in the Supabase Edge runtime. Start it if it is not
// already serving. The run keeps it alive afterwards, so reruns start quickly.
export default async function globalSetup(): Promise<void> {
  if (await webhookReady()) return;

  const logPath = `${REPO_ROOT}/tests/e2e/functions.log`;
  const log = openSync(logPath, "a");
  const child = spawn(
    "pnpm",
    ["exec", "supabase", "functions", "serve", "razorpay-webhook", "--env-file", "tests/e2e/functions.env"],
    { cwd: REPO_ROOT, detached: true, stdio: ["ignore", log, log] },
  );
  child.unref();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await webhookReady()) return;
    await sleep(2_000);
  }
  throw new Error(`razorpay-webhook did not start. See ${existsSync(logPath) ? logPath : "the functions log"}.`);
}
