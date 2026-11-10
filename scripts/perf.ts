/**
 * Draw calls, triangles and the heaviest meshes per quality tier.
 *
 *   npx tsx scripts/perf.ts [low,medium,high]
 *
 * Needs `npm run dev` on port 5173.
 */
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const q of (process.argv[2] ?? "low,high").split(",")) {
  await page.goto(`http://localhost:5173/?test&quality=${q}`);
  await page.waitForSelector("html[data-stage=ready]", { timeout: 60000 });
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => [(window as any).__poh.stats(), (window as any).__poh.heavy()]);
  console.log(q, JSON.stringify(s));
}
await browser.close();
