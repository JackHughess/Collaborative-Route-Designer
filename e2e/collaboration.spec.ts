import { expect, test } from "@playwright/test";
import { accounts, createPlay, deletePlay, player, playerX, signIn } from "./helpers";

let playId: string | undefined;
test.afterEach(() => deletePlay(playId));

test("invite a collaborator, edit together live, then make them a viewer", async ({
  browser,
}) => {
  const owner = await (await browser.newContext()).newPage();
  const collab = await (await browser.newContext()).newPage();

  // Owner signs in and creates a play.
  await owner.goto("/login");
  await signIn(owner, accounts.owner());
  await owner.waitForURL("**/dashboard");
  playId = await createPlay(owner, "E2E collaboration");

  // Owner creates an editor invite link.
  await owner.getByRole("button", { name: "Share" }).click();
  await owner.getByRole("button", { name: "Create link" }).click();
  const link = await owner.getByRole("textbox", { name: "Invite link" }).inputValue();
  expect(link).toContain("/invite/");
  await owner.keyboard.press("Escape");

  // Collaborator opens the link, is sent to sign in, then accepts.
  await collab.goto(link);
  await collab.waitForURL("**/login**");
  await signIn(collab, accounts.collaborator());
  await collab.waitForURL("**/invite/**");
  await collab.getByRole("button", { name: "Accept and open the play" }).click();
  await collab.waitForURL(`**/play/${playId}`);
  await expect(collab.getByText("Saved")).toBeVisible({ timeout: 15_000 });

  // Both see each other.
  for (const page of [owner, collab]) {
    await expect(page.locator('[aria-label^="Here now:"] [title]')).toHaveCount(2);
  }

  // Owner moves a player: the collaborator sees it, plus the owner's selection.
  const before = await playerX(collab, 0);
  await player(owner, 0).click();
  await owner.keyboard.press("Shift+ArrowRight");
  await expect.poll(() => playerX(collab, 0)).not.toBe(before);
  await expect(player(collab, 0).locator("circle[stroke-dasharray]")).not.toHaveCount(0);

  // Collaborator moves another player: the owner sees it.
  const before1 = await playerX(owner, 1);
  await player(collab, 1).click({ force: true });
  await collab.keyboard.press("Shift+ArrowLeft");
  await expect.poll(() => playerX(owner, 1)).not.toBe(before1);

  // Edits are saved: a fresh load shows them.
  await expect(owner.getByText("Saved")).toBeVisible();
  const saved = await playerX(owner, 0);
  await owner.waitForTimeout(3_000); // server saves on a ~2 s debounce
  await owner.reload();
  await expect.poll(() => playerX(owner, 0)).toBe(saved);

  // Owner makes the collaborator a viewer; they can watch but not edit.
  await owner.getByRole("button", { name: "Share" }).click();
  await owner.getByLabel(/^Role for /).selectOption("viewer");
  await expect(owner.getByLabel(/^Role for /)).toHaveValue("viewer");
  await owner.keyboard.press("Escape");

  await collab.reload();
  await expect(collab.getByText(/You're viewing this play/)).toBeVisible();
  const frozen = await playerX(collab, 0);
  await player(collab, 0).click({ force: true });
  await collab.keyboard.press("Shift+ArrowRight");
  await collab.waitForTimeout(1_000);
  expect(await playerX(collab, 0)).toBe(frozen);
  expect(await playerX(owner, 0)).toBe(frozen);
});
