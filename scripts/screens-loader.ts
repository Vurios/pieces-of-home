/**
 * Captures the loading page and the handoff into the 3D title, frame by frame.
 *
 *   npx tsx scripts/screens-loader.ts [folder] [baseUrl]
 *
 * Desktop only, 1440x900 (DECISIONS #41). Uses Chrome with the graphics chip,
 * so the handoff shows the real lamp coming on. Needs a running site.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

type Boot = { progress(p: number): void; milestone(i: number): void };

const [folder = "loader", baseUrl = "http://localhost:5173"] = process.argv.slice(2);
const outDir = fileURLToPath(new URL(`../docs/screens/${folder}/`, import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
let errors = 0;
const shot = async (page: import("@playwright/test").Page, name: string): Promise<void> => {
  await page.screenshot({ path: `${outDir}${name}-1440x900.jpg` });
  console.log(name);
};

// The page alone, with the game held back so progress can be set by hand.
{
  const page = await context.newPage();
  await page.route("**/src/main.ts*", (route) => route.abort());
  await page.route("**/assets/main-*.js", (route) => route.abort());
  await page.goto(`${baseUrl}/?intro`, { waitUntil: "commit" });
  await page.waitForSelector("#boot");
  await page.waitForTimeout(700);
  await shot(page, "ld-1-cover");
  await page.waitForTimeout(650);
  await shot(page, "ld-2-opening");
  await page.evaluate(() => (window as unknown as { __pohBoot: Boot }).__pohBoot.progress(0.3));
  await page.waitForTimeout(1400);
  await shot(page, "ld-3-open");
  await page.evaluate(() => {
    const boot = (window as unknown as { __pohBoot: Boot }).__pohBoot;
    boot.progress(0.72);
    boot.milestone(0);
    boot.milestone(1);
  });
  await page.mouse.move(1100, 300);
  await page.waitForTimeout(1300);
  await shot(page, "ld-4-loading");
  await page.close();
}

// The real thing: ready, the switch, and the handoff to the live workshop.
{
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    errors += 1;
    console.log("  page error:", String(e));
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors += 1;
      console.log("  console error:", m.text());
    }
  });
  await page.goto(`${baseUrl}/?intro&test`);
  await page.waitForSelector("#boot[data-prompt]", { timeout: 120_000 });
  await page.mouse.move(720, 450);
  await page.waitForTimeout(900);
  await shot(page, "ld-5-ready");
  await page.keyboard.press("Space");
  const pressed = Date.now();
  for (const [ms, name] of [
    [180, "ld-6-switch"],
    [500, "ld-7-closing"],
    [950, "ld-8-dropping"],
    [1350, "ld-9-reveal"],
    [1800, "ld-10-lamp"],
    [2600, "ld-11-light"],
    [4200, "ld-12-flight"],
  ] as const) {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - pressed)));
    await shot(page, name);
  }
  await page.close();
}
await browser.close();
console.log(errors ? `${errors} errors` : "no errors");
