import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

// The three Vite dev servers are reused when already running. Otherwise Playwright starts them.
const devServer = (app: string, port: number) => ({
  command: `pnpm --filter ${app} exec vite --port ${port} --strictPort --host 127.0.0.1`,
  url: `http://127.0.0.1:${port}/`,
  cwd: REPO_ROOT,
  reuseExistingServer: true,
  timeout: 120_000,
});

export default defineConfig({
  testDir: ".",
  testMatch: ["healthoraa-lifecycle.spec.ts", "regressions.spec.ts"],
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  // One browser context per portal, shared across serial steps. Parallel runs would race on the same rows.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [devServer("admin-portal", 5180), devServer("doctor-portal", 5190), devServer("patient-portal", 5200)],
});
