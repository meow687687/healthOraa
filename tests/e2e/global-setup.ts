import { spawn } from "node:child_process";
import { openSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { PID_FILE } from "./support/paths";
import { webhookReady } from "./support/webhook";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

// The razorpay-webhook Edge Function runs in the Supabase Edge runtime. Start it if it is not
// already serving, and remember the process so the teardown can stop it. A runtime that was
// already running is left alone.
export default async function globalSetup(): Promise<void> {
  if (await webhookReady()) return;

  const log = openSync(fileURLToPath(new URL("./functions.log", import.meta.url)), "a");
  const child = spawn(
    "pnpm",
    ["exec", "supabase", "functions", "serve", "razorpay-webhook", "--env-file", "tests/e2e/functions.env"],
    { cwd: REPO_ROOT, detached: true, stdio: ["ignore", log, log] },
  );
  child.unref();
  if (child.pid) writeFileSync(PID_FILE, String(child.pid));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await webhookReady()) return;
    await sleep(2_000);
  }
  throw new Error("razorpay-webhook did not start. See tests/e2e/functions.log.");
}
