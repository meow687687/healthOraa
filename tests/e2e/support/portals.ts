import { expect, type Page } from "@playwright/test";
import { PERSONAS, PORTALS } from "./config";

export type Portal = keyof typeof PORTALS;

// Opens a portal and signs in with its one-click dev persona, then waits for the session pill.
export const signInAs = async (page: Page, portal: Portal): Promise<void> => {
  await page.goto(PORTALS[portal], { waitUntil: "networkidle" });
  // The persona button's accessible name also contains its email, so match the label as a substring.
  await page.getByRole("button", { name: PERSONAS[portal].button }).click();
  // The admin keeps sign-out inside its account menu, so the session is confirmed by the account chip there.
  // The doctor and patient portals show a visible Sign Out button in their top bar.
  if (portal === "admin") {
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible({ timeout: 20_000 });
    return;
  }
  await expect(page.getByRole("button", { name: "Sign Out", exact: true })).toBeVisible({ timeout: 20_000 });
};
