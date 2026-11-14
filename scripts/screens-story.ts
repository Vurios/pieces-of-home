/**
 * Captures the storybook before a new story: each page, a page mid-turn and
 * the camera at the end of its glide.
 *
 *   npx tsx scripts/screens-story.ts [folder] [baseUrl]
 *
 * Desktop only, 1440x900 (DECISIONS #41), on Chrome with the graphics chip.
 * Needs a running site.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const [folder = "story", baseUrl = "http://localhost:5173"] = process.argv.slice(2);
const outDir = fileURLToPath(new URL(`../docs/screens/${folder}/`, import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
let errors = 0;
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
const shot = async (name: string): Promise<void> => {
  await page.screenshot({ path: `${outDir}${name}-1440x900.jpg` });
  console.log(name);
};
await page.addInitScript(() => localStorage.removeItem("poh.save.v1"));
await page.goto(`${baseUrl}/?intro&test`);
await page.waitForSelector("#boot[data-prompt]", { timeout: 120_000 });
await page.keyboard.press("Space");
await page.waitForSelector("html[data-stage=title]");
await page.waitForTimeout(2600);
await page.keyboard.press("KeyX");
const chain = page.getByRole("button", { name: /pull the light chain/i });
await chain.waitFor({ timeout: 30_000 });
await chain.focus();
await page.keyboard.press("Enter");
await page.waitForSelector("html[data-stage=menu]");
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "New story" }).click();
await page.waitForTimeout(400);
await shot("st-0-turn-in");
for (let i = 0; i < 6; i += 1) {
  await page.waitForTimeout(i === 0 ? 2000 : 2200);
  await shot(`st-${i + 1}-page`);
  if (i === 2) {
    await page.waitForTimeout(6500);
    await shot(`st-${i + 1}-glide-end`);
  }
  if (i < 5) {
    await page.keyboard.press("ArrowRight");
    if (i === 1) {
      await page.waitForTimeout(330);
      await shot("st-turning");
    }
  }
}
await browser.close();
console.log(errors ? `${errors} errors` : "no errors");
