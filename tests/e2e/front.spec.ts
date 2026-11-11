import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

/**
 * The front door: loader, title, menu, notebook, settings, Field Guide and
 * About. Runs the real intro, and checks every 2D screen with axe-core.
 */
// The real intro on a CPU renderer, two pages at once, needs more than the default minute.
test.describe.configure({ timeout: 150_000 });

const stage = (page: Page) => page.locator("html");

async function axe(page: Page, what: string): Promise<void> {
  // The 3D canvas has no DOM to check; everything drawn over it does.
  const result = await new AxeBuilder({ page }).exclude("#stage").analyze();
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${what}: ${v.id} (${v.nodes.length}) ${v.help}`)).toEqual([]);
}

async function toMenu(page: Page): Promise<void> {
  await page.goto("/?test&intro&quality=low");
  await expect(stage(page)).toHaveAttribute("data-stage", "waiting", { timeout: 60_000 });
  await expect(page.locator("#boot")).toHaveAttribute("data-prompt", "", { timeout: 10_000 });
  await page.keyboard.press("Space");
  await expect(stage(page)).toHaveAttribute("data-stage", "title");
  // Any key skips the flight; then the chain waits for a pull.
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyX");
  const chain = page.getByRole("button", { name: /pull the light chain/i });
  await expect(chain).toBeVisible({ timeout: 20_000 });
  await chain.focus();
  await page.keyboard.press("Enter");
  await expect(stage(page)).toHaveAttribute("data-stage", "menu", { timeout: 10_000 });
}

test("the light, the title and the chain lead to the menu, then into play", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "keyboard path runs on desktop");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await toMenu(page);
  await expect(page.getByRole("navigation", { name: /menu/i })).toBeVisible();
  // Menu tabs answer the arrow keys.
  const first = page.locator(".menu .tab").first();
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".menu .tab").nth(1)).toBeFocused();
  await page.getByRole("button", { name: "New story" }).click();
  // A new story opens with a short story; it can be read page by page or skipped.
  const story = page.getByRole("dialog", { name: "The story so far" });
  await expect(story).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Skip story" }).click();
  await expect(story).toBeHidden();
  await expect(stage(page)).toHaveAttribute("data-stage", "ready", { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test("a gamepad alone gets from the loader to the notebook", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "gamepad path runs on desktop");
  // A pretend pad in the standard mapping. Tests flip its buttons.
  await page.addInitScript(() => {
    const pad = { id: "test pad", index: 0, connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad, null, null, null] });
  });
  // The page itself lets go after `hold` ms, on its own timer, so a slow test runner can never stretch a
  // short D-pad tap into a held, repeating one. Buttons are held well over a second, since the game reads
  // them once a frame and the CPU renderer may draw only one frame a second; they fire once per press.
  const tap = async (index: number, hold = 1500): Promise<void> => {
    await page.evaluate(
      ([i, ms]) => {
        const pad = (window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad;
        pad.buttons[i]!.pressed = true;
        window.setTimeout(() => (pad.buttons[i]!.pressed = false), ms);
      },
      [index, hold] as const,
    );
    await page.waitForTimeout(hold + 450);
  };
  const A = 0;
  const B = 1;
  const DOWN = 13;
  const UP = 12;
  const VIEW = 8;
  const RB = 5;

  await page.goto("/?test&intro&quality=low");
  await expect(stage(page)).toHaveAttribute("data-stage", "waiting", { timeout: 60_000 });
  await expect(page.locator("#boot")).toHaveAttribute("data-prompt", "", { timeout: 10_000 });
  await tap(A);
  await expect(stage(page)).toHaveAttribute("data-stage", "title", { timeout: 15_000 });
  // A finds the Skip button, A again presses it.
  await tap(A);
  await tap(A);
  const chain = page.getByRole("button", { name: /pull the light chain/i });
  await expect(chain).toBeFocused({ timeout: 20_000 });
  await tap(A);
  await expect(stage(page)).toHaveAttribute("data-stage", "menu", { timeout: 10_000 });
  await expect(page.locator(".menu .tab").first()).toBeFocused();
  await tap(DOWN, 380);
  await expect(page.locator(".menu .tab").nth(1)).toBeFocused();
  await tap(UP, 380);
  await tap(A);
  // B skips the short story that opens a new game.
  await expect(page.getByRole("dialog", { name: "The story so far" })).toBeVisible();
  await tap(B);
  await expect(stage(page)).toHaveAttribute("data-stage", "ready", { timeout: 30_000 });
  await tap(VIEW);
  const book = page.locator(".notebook");
  await expect(book).toBeVisible();
  await tap(RB);
  await expect(book.getByText("2 / 7")).toBeVisible();
  await tap(B);
  await expect(book).toBeHidden();
});

test("a tap on the loader turns on the light", async ({ page }) => {
  await page.goto("/?test&intro&quality=low");
  await expect(stage(page)).toHaveAttribute("data-stage", "waiting", { timeout: 60_000 });
  await expect(page.locator("#boot")).toHaveAttribute("data-prompt", "", { timeout: 10_000 });
  await page.locator("#boot").click({ position: { x: 40, y: 40 } });
  await expect(stage(page)).toHaveAttribute("data-stage", "title");
});

test("menu, settings and credits pass axe", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "one size is enough");
  await toMenu(page);
  await page.waitForTimeout(900);
  await axe(page, "menu");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await axe(page, "settings");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Credits" }).click();
  await expect(page.getByRole("dialog", { name: "Credits" })).toBeVisible();
  await axe(page, "credits");
});

test("the notebook opens, turns with the keys and passes axe", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "keyboard path runs on desktop");
  await page.goto("/?test&quality=low");
  await expect(stage(page)).toHaveAttribute("data-stage", "ready", { timeout: 60_000 });
  await page.keyboard.press("KeyN");
  const book = page.locator(".notebook");
  await expect(book).toBeVisible();
  await expect(book.getByText("1 / 7")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(book.getByText("2 / 7")).toBeVisible();
  await page.waitForTimeout(700);
  await axe(page, "notebook");
  await page.keyboard.press("Escape");
  await expect(book).toBeHidden();
});

test("the Field Guide works without 3D and passes axe", async ({ page }) => {
  await page.goto("/field-guide/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pieces of Home: Field Guide");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("article.machine")).toHaveCount(6);
  await expect(page.getByText("Dad's sketch. Not to scale.").first()).toBeVisible();
  // Every photo has its credit line.
  const photos = page.locator("figure.photo");
  const count = await photos.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) await expect(photos.nth(i).locator("figcaption")).toContainText("Photo:");
  await axe(page, "field guide");
});

test("the About page has the note for grown-ups and passes axe", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.getByRole("heading", { name: "For grown-ups" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read the Field Guide" })).toHaveAttribute("href", "/field-guide/");
  await axe(page, "about");
});
