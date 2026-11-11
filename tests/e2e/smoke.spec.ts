import { expect, test } from "@playwright/test";

test("page loads, the canvas draws, and nothing logs an error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/");
  await expect(page).toHaveTitle("Pieces of Home");
  // A plain visit waits on the loader for the player to turn on the light.
  await expect(page.locator("html")).toHaveAttribute("data-stage", "waiting", { timeout: 60_000 });
  await expect(page.locator("#boot")).toHaveAttribute("data-state", "ready");
  await expect.poll(() => page.locator("#boot-progress").evaluate((el) => (el as HTMLProgressElement).value)).toBe(100);
  await expect(page.locator("canvas#stage")).toBeAttached();
  // Solo by default: no room socket unless the link asks for one.
  await expect(page.locator("html")).toHaveAttribute("data-net", "solo");

  expect(errors).toEqual([]);
});

test("health endpoint answers", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { ok: boolean; version: string; time: string };
  expect(body.ok).toBe(true);
  expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  expect(Number.isNaN(Date.parse(body.time))).toBe(false);
});

test("a room WebSocket connects", async ({ page }, testInfo) => {
  const room = `smoke-${testInfo.project.name}-${Date.now() % 100000}`;
  await page.goto(`/?room=${room}&test&quality=low`);
  // CPU-drawn WebGL plus a trace recording can hold the page's first frames for a while.
  await expect(page.locator("html")).toHaveAttribute("data-net", "connected", { timeout: 40_000 });
  await expect(page.locator("html")).toHaveAttribute("data-players", "1");
});

test("two players in one room see each other counted", async ({ browser }, testInfo) => {
  // Two pages, each drawing the 3D world on the CPU, beside another test: give them time.
  test.setTimeout(120_000);
  const room = `pair-${testInfo.project.name}-${Date.now() % 100000}`;
  const first = await browser.newPage();
  const second = await browser.newPage();
  await first.goto(`/?room=${room}&test&quality=low`);
  await expect(first.locator("html")).toHaveAttribute("data-net", "connected", { timeout: 20_000 });
  await second.goto(`/?room=${room}&test&quality=low`);
  await expect(second.locator("html")).toHaveAttribute("data-players", "2", { timeout: 40_000 });
  await expect(first.locator("html")).toHaveAttribute("data-players", "2", { timeout: 40_000 });
  await second.close();
  await expect(first.locator("html")).toHaveAttribute("data-players", "1", { timeout: 40_000 });
  await first.close();
});
