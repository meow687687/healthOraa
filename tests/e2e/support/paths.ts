import { fileURLToPath } from "node:url";

// Written by global-setup when it starts the Edge runtime, read by the teardown.
export const PID_FILE = fileURLToPath(new URL("../.functions.pid", import.meta.url));
