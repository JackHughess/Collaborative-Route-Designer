import { expect, test } from "@playwright/test";
import { accounts, signIn } from "./helpers";

test("logged-out visitors are sent to sign in, then back where they were going", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await signIn(page, accounts.owner());
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "My plays" })).toBeVisible();
});

test("a wrong password shows an error and stays on the sign-in page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(accounts.owner());
  await page.getByLabel(/password/i).fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("signing out ends the session", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, accounts.owner());
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
