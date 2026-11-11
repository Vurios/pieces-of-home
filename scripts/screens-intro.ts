/**
 * Walks the front end and captures every Phase 03 state:
 * loader at 0, 50 and 100 percent, the title mid-flight, mid-assembly and
 * complete, the menu, settings, HUD in play, the speech bubble and stamp,
 * the notebook, and the Field Guide.
 *
 *   npx tsx scripts/screens-intro.ts [folder] [baseUrl] [sizes]
 *
 * `sizes` is "desktop" (default) or "all". `part` is "all" (default), "intro",
 * "notebook" or "guide", to rerun one stretch. Needs a running site.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Page, chromium } from "@playwright/test";

const [
  folder = "phase03",
  baseUrl = "http://localhost:5173",
  sizeList = "desktop",
  part = "all",
] = process.argv.slice(2);
const outDir = fileURLToPath(
  new URL(`../docs/screens/${folder}/`, import.meta.url),
);
mkdirSync(outDir, { recursive: true });
const sizes = [
  { label: "1440x900", width: 1440, height: 900, mobile: false },
  ...(sizeList === "all"
    ? [{ label: "390x844", width: 390, height: 844, mobile: true }]
    : []),
];

const browser = await chromium.launch({
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
let errors = 0;

for (const size of sizes) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    hasTouch: size.mobile,
    isMobile: size.mobile,
  });
  const shot = async (page: Page, name: string): Promise<void> => {
    await page.screenshot({ path: `${outDir}${name}-${size.label}.png` });
    console.log(`${name}-${size.label}`);
  };
  const watch = (page: Page): void => {
    page.on("console", (m) => {
      if (m.type() === "error") {
        errors += 1;
        console.log("  console error:", m.text());
      }
    });
    page.on("pageerror", (e) => {
      errors += 1;
      console.log("  page error:", String(e));
    });
  };

  // Loader states, with the game script held back so we can set progress by hand.
  if (part === "all" || part === "intro") {
    const page = await context.newPage();
    await page.route("**/src/main.ts*", (route) => route.abort());
    await page.route("**/assets/main-*.js", (route) => route.abort());
    await page.goto(`${baseUrl}/?test&intro`);
    await page.waitForTimeout(600);
    await shot(page, "loader-0");
    await page.evaluate(() => {
      const boot = (window as unknown as { __pohBoot?: { progress(p: number): void; milestone(i: number): void } }).__pohBoot;
      boot?.progress(0.5);
      boot?.milestone(0);
      boot?.milestone(1);
    });
    await page.waitForTimeout(1200);
    await shot(page, "loader-50");
    await page.close();
  }

  // The real thing, from the first frame.
  if (part === "all" || part === "intro") {
    const page = await context.newPage();
    watch(page);
    await page.addInitScript(() =>
      localStorage.setItem(
        "poh.settings.v1",
        JSON.stringify({ exploreFreely: false, readAloud: true }),
      ),
    );
    await page.goto(`${baseUrl}/?test&intro&quality=high`);
    await page.waitForSelector("html[data-stage=waiting]", { timeout: 90_000 });
    await page.waitForTimeout(1800);
    await shot(page, "loader-100-light");

    await page.keyboard.press("Space");
    await page.waitForTimeout(700);
    await shot(page, "curl");
    await page.waitForTimeout(2300);
    await shot(page, "title-flight");
    await page.waitForFunction(
      () =>
        (
          window as unknown as { __poh: { titlePhase(): string } }
        ).__poh.titlePhase() === "letters",
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(900);
    await shot(page, "title-assembly");
    await page.waitForFunction(
      () =>
        (
          window as unknown as { __poh: { titlePhase(): string } }
        ).__poh.titlePhase() === "waiting",
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(1500);
    await shot(page, "title-complete");

    // The chain button follows the swaying tag every frame, so press it from the keyboard.
    console.log(
      "  hint:",
      await page.locator("p.pull-hint").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return `${el.textContent?.trim()} at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} opacity ${getComputedStyle(el).opacity}`;
      }),
    );
    await page.locator(".chain").focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("html[data-stage=menu]");
    await page.waitForTimeout(1600);
    await shot(page, "menu");

    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForTimeout(700);
    await shot(page, "settings");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Credits" }).click();
    await page.waitForTimeout(700);
    await shot(page, "credits");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "New story" }).click();
    await page.waitForSelector("html[data-stage=ready]", { timeout: 30_000 });
    await page.waitForTimeout(1600);
    await shot(page, "play-hud-mom");

    await page.evaluate(() =>
      (
        window as unknown as { __poh: { teleportTo(id: string): boolean } }
      ).__poh.teleportTo("mailbox"),
    );
    await page.getByText("Take the letter").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await shot(page, "play-prompt");
    // Hold each key across a few frames: the CPU renderer draws only a few per second.
    const tap = async (code: string): Promise<void> => {
      await page.keyboard.down(code);
      await page.waitForTimeout(350);
      await page.keyboard.up(code);
    };
    await tap("KeyE");
    await page.waitForFunction(
      () =>
        (
          window as unknown as {
            __poh: { state(): { carrying: string | null } };
          }
        ).__poh.state().carrying !== null,
      null,
      { timeout: 15_000 },
    );
    await page.evaluate(() =>
      (
        window as unknown as { __poh: { teleportTo(id: string): boolean } }
      ).__poh.teleportTo("lamp"),
    );
    await page
      .getByText("Give the letter to the lamp")
      .waitFor({ timeout: 15_000 });
    // A slow CPU screenshot outlasts the 3-second stamp, so keep a copy of it once it lands.
    await page.evaluate(() => {
      const watch = new MutationObserver(() => {
        const moment = document.querySelector(".moment");
        if (!moment || document.getElementById("shot-copy")) return;
        moment.parentElement?.appendChild(Object.assign(moment.cloneNode(true) as HTMLElement, { id: "shot-copy" }));
        watch.disconnect();
      });
      watch.observe(document.body, { childList: true, subtree: true });
    });
    await tap("KeyE");
    await page
      .locator(".bubble")
      .filter({ hasText: "Dad" })
      .waitFor({ timeout: 15_000 });
    await page.waitForTimeout(900);
    await shot(page, "speech-bubble");
    await page.locator("#shot-copy").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    await shot(page, "stamp");
    await page.evaluate(() => document.getElementById("shot-copy")?.remove());
    await page.waitForTimeout(5000);

    await page.keyboard.press("KeyG");
    await page.waitForTimeout(500);
    await shot(page, "emotes");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.keyboard.press("KeyN");
    await page.waitForTimeout(900);
    await shot(page, "notebook-cover");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(900);
    await shot(page, "notebook-lamp");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(900);
    await shot(page, "notebook-pencil");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.close();
  }

  // Explore freely inks every page. A fresh page, since init scripts run again on every load.
  if (part === "all" || part === "notebook") {
    const page = await context.newPage();
    watch(page);
    await page.addInitScript(() =>
      localStorage.setItem(
        "poh.settings.v1",
        JSON.stringify({ exploreFreely: true, readAloud: true }),
      ),
    );
    await page.goto(`${baseUrl}/?test&quality=low`);
    await page.waitForSelector("html[data-stage=ready]", { timeout: 90_000 });
    await page.waitForTimeout(800);
    await page.keyboard.press("KeyN");
    await page.waitForTimeout(500);
    for (const [i, name] of [
      "notebook-lrrr",
      "notebook-lrv",
      "notebook-opportunity",
      "notebook-ingenuity",
      "notebook-voyager",
    ].entries()) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(700);
      if (i === 0) await page.keyboard.press("ArrowRight");
      if (i === 0) await page.waitForTimeout(700);
      await shot(page, name);
    }
    await page.close();
  }

  if (part === "all" || part === "guide") {
    const guide = await context.newPage();
    watch(guide);
    await guide.goto(`${baseUrl}/field-guide/`);
    await guide.waitForTimeout(800);
    await shot(guide, "field-guide");
    await guide.close();
  }
  await context.close();
}
await browser.close();
console.log(errors ? `${errors} console errors` : "no console errors");
process.exit(errors ? 1 : 0);
