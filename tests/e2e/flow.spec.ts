import { type Page, expect, test } from "@playwright/test";

interface Poh {
  state(): { carrying: string | null; delivered: string[] };
  player(): { position: [number, number, number]; grounded: boolean };
  teleportTo(id: string): boolean;
}

async function ready(page: Page, query = ""): Promise<void> {
  await page.goto(`/?test${query}`);
  await expect(page.locator("html")).toHaveAttribute("data-stage", "ready", { timeout: 60_000 });
}

const poh = <T>(page: Page, fn: (api: Poh) => T): Promise<T> =>
  page.evaluate((source) => {
    const api = (window as unknown as { __poh: Poh }).__poh;
    return new Function("api", `return (${source})(api)`)(api) as T;
  }, fn.toString());

test("walking with the keyboard moves the player over the planet", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "keyboard test runs on desktop");
  // Low tier: headless runs draw on the CPU, and a slow frame rate would make the walk short.
  await ready(page, "&quality=low");
  const before = await poh(page, (api) => api.player().position);
  await page.locator("canvas#stage").click({ position: { x: 700, y: 300 } });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(3000);
  await page.keyboard.up("KeyW");
  const after = await poh(page, (api) => api.player().position);
  const moved = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
  expect(moved).toBeGreaterThan(0.5);
  // Still standing on the little planet.
  const radius = Math.hypot(...after);
  expect(radius).toBeGreaterThan(18);
  expect(radius).toBeLessThan(24);
});

test("take the letter from the mailbox and give it to the lamp", async ({ page }, info) => {
  await ready(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  expect(await poh(page, (api) => api.teleportTo("mailbox"))).toBe(true);
  await expect(page.getByText("Take the letter")).toBeVisible({ timeout: 10_000 });
  if (info.project.name === "phone") await page.getByRole("button", { name: "Take the letter" }).tap();
  else await page.keyboard.press("KeyE");
  await expect.poll(() => poh(page, (api) => api.state().carrying), { timeout: 15_000 }).toBe("to-the-lamp");

  expect(await poh(page, (api) => api.teleportTo("lamp"))).toBe(true);
  await expect(page.getByText("Give the letter to the lamp")).toBeVisible({ timeout: 10_000 });
  if (info.project.name === "phone") await page.getByRole("button", { name: "Give the letter to the lamp" }).tap();
  else await page.keyboard.press("KeyE");
  await expect.poll(() => poh(page, (api) => api.state().delivered), { timeout: 15_000 }).toContain("to-the-lamp");
  expect(errors).toEqual([]);
});

test("every quality tier draws without errors", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "one size is enough");
  for (const tier of ["low", "medium", "high"]) {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await ready(page, `&quality=${tier}`);
    await expect(page.locator("html")).toHaveAttribute("data-tier", tier);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  }
});
