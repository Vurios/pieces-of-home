import { type Page, expect, test } from "@playwright/test";

/**
 * Chapter playthroughs (Phase 05). Each test plays a chapter's critical path
 * from the dome on Dad's workbench to the stamp, using the debug hooks to
 * walk (teleport) but pressing the real interact key for every step, and
 * clicking "Got it" on every story card.
 */
interface State {
  world: string;
  carrying: string | null;
  delivered: string[];
  stamps: string[];
  flags: string[];
  miloStage: number;
}

interface Poh {
  state(): State;
  teleportTo(id: string): boolean;
  worldId(): string | null;
}

const AFTER_PROLOGUE = { version: 1, world: "home", miloStage: 0, carrying: null, delivered: ["to-the-lamp"], stamps: ["prologue"], flags: ["seen-notebook"] };

async function start(page: Page): Promise<void> {
  await page.addInitScript((save) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("poh.save.v1", JSON.stringify(save));
      sessionStorage.setItem("seeded", "1");
    }
  }, AFTER_PROLOGUE);
  await page.goto("/?test&quality=low");
  await expect(page.locator("html")).toHaveAttribute("data-stage", "ready", { timeout: 60_000 });
}

const state = (page: Page): Promise<State> => page.evaluate(() => (window as unknown as { __poh: Poh }).__poh.state());

async function goTo(page: Page, id: string): Promise<void> {
  const ok = await page.evaluate((target) => (window as unknown as { __poh: Poh }).__poh.teleportTo(target), id);
  expect(ok, `teleport to ${id}`).toBe(true);
  await page.waitForTimeout(400);
}

async function use(page: Page): Promise<void> {
  // While a story card is up, the interact key belongs to the card.
  while (await page.locator(".card .got").count()) {
    await page.waitForTimeout(500);
    await page.locator(".card .got").click();
    await page.waitForTimeout(300);
  }
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyE");
  await page.waitForTimeout(300);
}

/** Clicks through story cards until `done` is true. */
async function playUntil(page: Page, done: (s: State) => boolean, timeout = 40_000): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (done(await state(page))) return;
    const got = page.locator(".card .got");
    if (await got.count()) {
      await page.waitForTimeout(500);
      await got.click();
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`timed out; state ${JSON.stringify(await state(page))}`);
}

test("Chapter 1: from the dome to the stamp", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "one full playthrough on desktop is enough");
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await start(page);

  // Into the Moon dome, through the lamp countdown.
  await goTo(page, "dome-tranquility");
  await use(page);
  await page.waitForFunction(() => (window as unknown as { __poh: Poh }).__poh.worldId() === "tranquility", null, { timeout: 30_000 });
  await playUntil(page, (s) => s.carrying === "a11-letter-descent");

  // Three letters, each with its story beat.
  for (const [target, next] of [
    ["descent", "a11-letter-seismometer"],
    ["seismometer", "a11-letter-mirrors"],
  ] as const) {
    await goTo(page, `letter-${target}`);
    await use(page);
    await playUntil(page, (s) => s.carrying === next);
  }
  await goTo(page, "letter-lrrr");
  await use(page);
  await playUntil(page, (s) => s.flags.includes("send-a-light:started"));

  // Send a Light: two more mirrors, a turn of the frame, then one blink from Earth.
  for (const panel of ["a", "b"]) {
    await goTo(page, `mirror-${panel}`);
    await use(page);
    expect((await state(page)).carrying).toBe(`mirror:${panel}`);
    await goTo(page, "frame-fit");
    await use(page);
  }
  await playUntil(page, (s) => s.flags.includes("send-a-light:mirrors"));
  await goTo(page, "frame-turn");
  await use(page);
  await playUntil(page, (s) => s.flags.includes("send-a-light:turn"));
  await goTo(page, "earth-console");
  await use(page);
  await playUntil(page, (s) => s.flags.includes("send-a-light:done"));

  // Milo's parcel, home through the lamp light, and his new eyes.
  await playUntil(page, () => true);
  await page.waitForTimeout(1500);
  await goTo(page, "parcel");
  await use(page);
  expect((await state(page)).carrying).toBe("part:chapter-1");
  await goTo(page, "lamp-home");
  await use(page);
  await page.waitForFunction(() => (window as unknown as { __poh: Poh }).__poh.worldId() === "home", null, { timeout: 30_000 });
  await page.waitForTimeout(800);
  await goTo(page, "milo");
  await use(page);
  await playUntil(page, (s) => s.stamps.includes("chapter-1"), 60_000);
  const end = await state(page);
  expect(end.miloStage).toBe(1);
  expect(end.carrying).toBeNull();
  expect(errors).toEqual([]);
});
