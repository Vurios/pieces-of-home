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

// The playthroughs are long and draw on the CPU: run them one after another, never side by side.
test.describe.configure({ mode: "default" });

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

/**
 * Plays one move of a story game, if one is up (Chapter 3): grind the rock and
 * find the blueberries, read the rover's last report, send the calls.
 */
async function playGame(page: Page): Promise<void> {
  const game = page.locator(".game");
  if (!(await game.count())) return;
  const kind = (await game.getAttribute("class")) ?? "";
  await page.waitForTimeout(500);
  if (kind.includes("telemetry")) await page.locator(".game .got").click();
  else if (kind.includes("blueberries")) {
    const berry = page.locator(".game .berry:not(.found)");
    if (await berry.count()) await berry.first().click();
    else if (!(await page.locator(".game .berry").count())) {
      // Grinding fills while the key is held.
      await page.keyboard.down("KeyE");
      await page.waitForTimeout(2600);
      await page.keyboard.up("KeyE");
    }
  } else if (kind.includes("calls")) {
    const send = page.locator(".game .btn");
    if (await send.isEnabled()) await send.click();
  }
}

/** Clicks through story cards and story games until `done` is true. */
async function playUntil(page: Page, done: (s: State) => boolean, timeout = 40_000): Promise<void> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (done(await state(page))) return;
    const got = page.locator(".card .got");
    if (await got.count()) {
      await page.waitForTimeout(500);
      await got.click();
    }
    await playGame(page);
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

const AFTER_CHAPTER_1 = { version: 1, world: "home", miloStage: 1, carrying: null, delivered: ["to-the-lamp", "a11-letter-descent", "a11-letter-seismometer", "a11-letter-mirrors"], stamps: ["prologue", "chapter-1"], flags: ["seen-notebook"] };

test("Chapter 3: from the dome to the stamp", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "one full playthrough on desktop is enough");
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript((save) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("poh.save.v1", JSON.stringify(save));
      sessionStorage.setItem("seeded", "1");
    }
  }, AFTER_CHAPTER_1);
  await page.goto("/?test&quality=low");
  await expect(page.locator("html")).toHaveAttribute("data-stage", "ready", { timeout: 60_000 });

  // Into the Mars dome.
  await goTo(page, "dome-meridiani");
  await use(page);
  await page.waitForFunction(() => (window as unknown as { __poh: Poh }).__poh.worldId() === "meridiani", null, { timeout: 30_000 });
  await playUntil(page, (s) => s.carrying === "opp-letter-bounce", 90_000);

  // Three letters: the bounce marks, the rock grinder (with the blueberry game), the panels.
  await goTo(page, "letter-bounce");
  await use(page);
  await playUntil(page, (s) => s.carrying === "opp-letter-grinder", 90_000);
  await goTo(page, "letter-grinder");
  await use(page);
  await playUntil(page, (s) => s.carrying === "opp-letter-panels", 150_000);
  await goTo(page, "letter-panels");
  await use(page);
  await playUntil(page, (s) => s.flags.includes("wait-for-the-wind:started"), 90_000);

  // Wait for the Wind: take a breeze flag and plant it with the real keys...
  await playUntil(page, () => true);
  await goTo(page, "flag-take");
  await use(page);
  expect((await state(page)).carrying).toBe("flag:0");
  await goTo(page, "letter-panels");
  await use(page);
  await playUntil(page, (s) => s.flags.includes("wait-for-the-wind:flags"));
  expect((await state(page)).carrying).toBeNull();
  // ...then line all three up from the dust devils' lane to the rover, and send a devil along it.
  await page.evaluate(() => {
    const poh = (window as unknown as { __poh: { world(c: string): unknown } }).__poh;
    poh.world("guide");
    poh.world("devil");
  });
  await playUntil(page, (s) => s.flags.includes("wait-for-the-wind:clean"), 120_000);
  // The rover wakes, then the long storm: the last report and the calls nobody answers.
  await playUntil(page, (s) => s.flags.includes("wait-for-the-wind:done"), 90_000);
  const seen = new Set<string>();
  const end = Date.now() + 150_000;
  while (Date.now() < end) {
    for (const kind of ["telemetry", "calls"]) if (await page.locator(`.game.${kind}`).count()) seen.add(kind);
    if (seen.has("calls") && !(await page.locator(".game").count())) break;
    if (await page.locator(".card .got").count()) {
      await page.waitForTimeout(500);
      await page.locator(".card .got").click();
    }
    await playGame(page);
    await page.waitForTimeout(250);
  }
  expect([...seen].sort()).toEqual(["calls", "telemetry"]);
  await playUntil(page, () => false, 12_000).catch(() => undefined);

  // The solar heart for Milo, home through the lamp light.
  await goTo(page, "parcel");
  await use(page);
  expect((await state(page)).carrying).toBe("part:chapter-3");
  await goTo(page, "lamp-home");
  await use(page);
  await page.waitForFunction(() => (window as unknown as { __poh: Poh }).__poh.worldId() === "home", null, { timeout: 30_000 });
  await page.waitForTimeout(800);
  await goTo(page, "milo");
  await use(page);
  await playUntil(page, (s) => s.stamps.includes("chapter-3"), 60_000);
  const after = await state(page);
  expect(after.miloStage).toBe(3);
  expect(errors).toEqual([]);
});
