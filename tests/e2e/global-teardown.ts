import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { PID_FILE } from "./support/paths";

// Stops the Edge runtime only when this run started it. The process was started detached, so its
// process group is killed, and the runtime container is stopped as well.
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(PID_FILE)) return;
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  rmSync(PID_FILE, { force: true });
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // Already exited.
    }
    // The CLI exits a moment after the signal. Wait for the group to be gone, so nothing is left running.
    for (let attempt = 0; attempt < 20 && processGroupAlive(pid); attempt += 1) {
      await sleep(250);
    }
  }
  spawnSync("docker", ["stop", "supabase_edge_runtime_healthOraa"], { stdio: "ignore" });
}

const processGroupAlive = (pid: number): boolean => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
};
