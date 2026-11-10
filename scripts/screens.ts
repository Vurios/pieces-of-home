/**
 * Capture review screenshots at the two sizes the quality bar names:
 * 1440x900 and 390x844.
 *
 *   npx tsx scripts/screens.ts <folder> [shot,shot,...] [baseUrl] [quality]
 *
 * Each shot opens `/?shot=<name>`, a fixed camera bookmark from the world.
 * Saves to docs/screens/<folder>/<shot>-<size>.png. Needs a running site
 * (default http://localhost:5173, from `npm run dev`).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const [folder = "latest", shotList = "wide,porch,workshop,bench,character", baseUrl = "http://localhost:5173", quality = "high"] =
  process.argv.slice(2);
const outDir = fileURLToPath(new URL(`../docs/screens/${folder}/`, import.meta.url));
mkdirSync(outDir, { recursive: true });

const sizes = [
  { label: "1440x900", width: 1440, height: 900, mobile: false },
  { label: "390x844", width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let failures = 0;
for (const size of sizes) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    hasTouch: size.mobile,
    isMobile: size.mobile,
  });
  for (const shot of shotList.split(",")) {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    const url = new URL(`/?shot=${shot}&quality=${quality}`, baseUrl).href;
    await page.goto(url);
    await page.waitForSelector("html[data-stage=ready]", { timeout: 60_000 });
    await page.waitForTimeout(2500);
    const file = `${outDir}${shot}-${size.label}.png`;
    await page.screenshot({ path: file });
    if (errors.length > 0) failures += 1;
    console.log(`${file}${errors.length > 0 ? `  (${errors.length} console errors: ${errors[0]})` : ""}`);
    await page.close();
  }
  await context.close();
}
await browser.close();
process.exit(failures > 0 ? 1 : 0);
