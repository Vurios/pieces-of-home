/**
 * Renders the loading page's picture of Dad's workshop with the game itself.
 *
 *   npx tsx scripts/render-backdrop.ts [baseUrl]
 *
 * The opening waits on one view of the workshop at night, with Dad's lamp
 * dark: the first frame of the title flight. This script opens the game with
 * the real intro on a fast GPU, draws that frame with the loading page lifted,
 * and saves it as `public/loader/workshop.webp`. The loading page shows that
 * picture before any script runs, sized so it lines up with the live view, and
 * when the light is switched on the live world takes its place unseen.
 *
 * The picture is wide (2.4 to 1), so it covers every landscape screen: the
 * camera keeps its height in view and shows more at the sides on wider
 * screens, and the page crops the picture the same way. Run it again whenever
 * the workshop changes. Needs `npm run dev` (or any running build).
 */
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const [baseUrl = "http://localhost:5173"] = process.argv.slice(2);
const WIDTH = 2592;
const HEIGHT = 1080;
const out = fileURLToPath(new URL("../public/loader/", import.meta.url));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("page error:", String(e)));
// A fresh save: the workshop as a new player first sees it.
await page.addInitScript(() => {
  localStorage.removeItem("poh.save.v1");
  localStorage.setItem("poh.settings.v1", JSON.stringify({ quality: "high" }));
});
await page.goto(`${baseUrl}/?intro&test&quality=high&backdrop`);
await page.waitForSelector("html[data-stage=waiting]", { timeout: 120_000 });
await page.addStyleTag({ content: "#boot, #ui { display: none !important; }" });
await page.evaluate(() => (window as unknown as { __poh: { unveil(): void } }).__poh.unveil());
// Let the resolution settle at full size and the lamp motes drift into place.
await page.waitForTimeout(2500);
const raw = await page.locator("#stage").screenshot({ type: "png" });
await browser.close();

const file = `${out}workshop.webp`;
await sharp(raw).resize(WIDTH, HEIGHT).webp({ quality: 74, effort: 6, smartSubsample: true }).toFile(file);
// A tiny copy, inlined into the page as its first paint while the picture loads.
const tiny = await sharp(raw).resize(48, 20).blur(0.6).webp({ quality: 50 }).toBuffer();
const tinyFile = `${out}workshop-tiny.txt`;
const { writeFileSync } = await import("node:fs");
writeFileSync(tinyFile, `data:image/webp;base64,${tiny.toString("base64")}`);
console.log(`workshop.webp ${(statSync(file).size / 1024).toFixed(0)} KB, tiny ${tiny.length} bytes`);
