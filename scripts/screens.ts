/**
 * Capture review screenshots into docs/screens/ at the two sizes the quality
 * bar names: 1440x900 and 390x844.
 *
 *   npx tsx scripts/screens.ts [name] [path] [baseUrl]
 *
 * Needs a running site (default http://localhost:5173, from `npm run dev`).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const [name = "home", path = "/", baseUrl = "http://localhost:5173"] = process.argv.slice(2);
const outDir = fileURLToPath(new URL("../docs/screens/", import.meta.url));
mkdirSync(outDir, { recursive: true });

const sizes = [
  { label: "1440x900", width: 1440, height: 900 },
  { label: "390x844", width: 390, height: 844 },
];

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(new URL(path, baseUrl).href);
  await page.waitForTimeout(1500);
  const file = `${outDir}${name}-${size.label}.png`;
  await page.screenshot({ path: file });
  console.log(`${file}${errors.length > 0 ? `  (${errors.length} console errors: ${errors[0]})` : ""}`);
  await page.close();
}
await browser.close();
