import { expect, type Page } from "@playwright/test";
import { PERSONAS, PORTALS } from "./config";

export type Portal = keyof typeof PORTALS;

// Opens a portal and signs in with its one-click dev persona, then waits for the session pill.
export const signInAs = async (page: Page, portal: Portal): Promise<void> => {
  await page.goto(PORTALS[portal], { waitUntil: "networkidle" });
  // The persona button's accessible name also contains its email, so match the label as a substring.
  await page.getByRole("button", { name: PERSONAS[portal].button }).click();
  await expect(page.getByRole("button", { name: "Sign Out", exact: true })).toBeVisible({ timeout: 20_000 });
};
