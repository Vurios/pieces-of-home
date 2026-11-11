/**
 * Captures Dad's notebook and the stamp moment after the prologue: the cover
 * spread with the first patch earned, the lamp spread with its ink stamp and
 * letters, a pencil page, the goal card and the stamp moment itself.
 *
 *   npx tsx scripts/screens-notebook.ts [folder] [baseUrl]
 *
 * Desktop only, 1440x900 (DECISIONS #41). Needs a running site.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const [folder = "latest", baseUrl = "http://localhost:5173"] = process.argv.slice(2);
const outDir = fileURLToPath(new URL(`../docs/screens/${folder}/`, import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem("poh.save.v1", JSON.stringify({ version: 1, world: "home", miloStage: 0, carrying: null, delivered: ["to-the-lamp"], stamps: ["prologue"], flags: [] }));
});
await page.goto(`${baseUrl}/?test&quality=low`);
await page.waitForSelector("html[data-stage=ready]", { timeout: 90_000 });
await page.waitForTimeout(1500);
const shot = async (name: string): Promise<void> => {
  await page.screenshot({ path: `${outDir}${name}-1440x900.png` });
  console.log(name);
};
await shot("hud-goal");

await page.keyboard.press("KeyN");
await page.waitForTimeout(1200);
await shot("notebook-cover");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(1200);
await shot("notebook-lamp");
await page.locator(".page.right .scroll").first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
await page.waitForTimeout(500);
await shot("notebook-lamp-letters");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(1200);
await shot("notebook-pencil");
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// Still frames: show the stamp's last frame, not a moment mid-flight.
await page.evaluate(() => (document.documentElement.dataset["motion"] = "reduce"));
await page.evaluate(() => (window as unknown as { __poh: { emit(t: string, p: unknown): void } }).__poh.emit("stamp", { id: "prologue", lines: ["Left on.", "Still shining."] }));
await page.waitForSelector(".moment", { timeout: 10_000 });
// A CPU screenshot can outlast the stamp, so pin a copy of it on the page.
await page.evaluate(() => {
  const moment = document.querySelector(".moment");
  if (moment) moment.parentElement?.appendChild(Object.assign(moment.cloneNode(true) as HTMLElement, { id: "shot-copy" }));
});
await page.waitForTimeout(2200);
await shot("stamp");
console.log(errors.length ? errors.join("\n") : "no console errors");
await browser.close();
