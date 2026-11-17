import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env to run the e2e tests (see .env.example).`);
  return value;
}

export const accounts = {
  owner: () => env("E2E_OWNER_EMAIL"),
  collaborator: () => env("E2E_COLLAB_EMAIL"),
};

/** Fill in the sign-in form on the current page and submit it. */
export async function signIn(page: Page, email: string) {
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(env("E2E_PASSWORD"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Create a play from the dashboard and wait until it's connected. Returns its id. */
export async function createPlay(page: Page, name: string): Promise<string> {
  await page.goto("/dashboard");
  await page.getByPlaceholder("Mesh concept").fill(name);
  await page.getByRole("button", { name: "New play" }).click();
  await page.waitForURL("**/play/**");
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 15_000 });
  return page.url().split("/play/")[1];
}

export const player = (page: Page, index: number) =>
  page.locator('[aria-label^="Player "]').nth(index);

/** A player's drawn x position in yards (the token's main circle). */
export const playerX = (page: Page, index: number) =>
  player(page, index).locator("circle").last().getAttribute("cx");

/** Delete test plays with the secret key so runs don't pile up data. */
export async function deletePlay(id: string | undefined) {
  if (!id) return;
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  await admin.from("plays").delete().eq("id", id);
}
