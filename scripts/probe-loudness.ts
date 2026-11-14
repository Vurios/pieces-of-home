/**
 * Loudness probe: opens the game, turns on the light, and reads the master
 * output with an analyser every half second through the title, the menu,
 * the storybook and the first minute of play. Prints RMS and peak in dBFS.
 *
 *   npx tsx scripts/probe-loudness.ts [baseUrl]
 *
 * Needs a running site. Chrome with the graphics chip, desktop only.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

mkdirSync("docs/screens/sound", { recursive: true });

const [baseUrl = "http://localhost:5173"] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
await page.addInitScript(() => {
  localStorage.removeItem("poh.save.v1");
  localStorage.removeItem("poh.settings.v1");
});
await page.goto(`${baseUrl}/?intro&test`);
await page.waitForSelector("#boot[data-prompt]", { timeout: 120_000 });
await page.keyboard.press("Space");
// A plain string, so the TypeScript runner adds no helpers the page does not have.
await page.evaluate(`(() => {
  const wait = () => {
    const mx = window.__poh && window.__poh.mixer && window.__poh.mixer();
    if (!mx) return setTimeout(wait, 50);
    const an = mx.ctx.createAnalyser();
    an.fftSize = 4096;
    mx.out.connect(an);
    const buf = new Float32Array(an.fftSize);
    window.__loud = [];
    let peak = 0, sum = 0, n = 0;
    setInterval(() => {
      an.getFloatTimeDomainData(buf);
      for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n += 1; }
    }, 40);
    setInterval(() => {
      const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : "-inf");
      window.__loud.push({ t: Math.round(mx.ctx.currentTime * 10) / 10, rms: db(Math.sqrt(sum / Math.max(1, n))), peak: db(peak), stage: document.documentElement.dataset.stage });
      peak = 0; sum = 0; n = 0;
    }, 500);
  };
  wait();
})()`);
const dump = async (label: string): Promise<void> => {
  const rows = (await page.evaluate("window.__loud.splice(0)")) as { t: number; rms: string; peak: string; stage: string }[];
  console.log(`-- ${label}`);
  for (const r of rows) console.log(`  t=${r.t}s  rms ${r.rms} dB  peak ${r.peak} dB  (${r.stage})`);
};
await page.waitForTimeout(6000);
await dump("light on, title");
await page.waitForTimeout(8000);
await dump("title flight");
await page.keyboard.press("KeyX");
const chain = page.getByRole("button", { name: /pull the light chain/i });
await chain.waitFor({ timeout: 30_000 });
await chain.focus();
await page.keyboard.press("Enter");
await page.waitForSelector("html[data-stage=menu]");
await page.waitForTimeout(6000);
await page.screenshot({ path: "docs/screens/sound/menu-tip-1440x900.jpg" });
await dump("menu");
await page.getByRole("button", { name: "New story" }).click();
await page.waitForTimeout(6000);
await dump("storybook");
await page.getByRole("button", { name: /skip story/i }).click();
await page.waitForTimeout(5000);
await page.screenshot({ path: "docs/screens/sound/after-skip-1440x900.jpg" });
await dump("after the story");
// The "Your adventure" card waits for a click before play starts.
const go = page.locator("button.go").first();
if (await go.isVisible().catch(() => false)) await go.click();
await page.waitForSelector("html[data-stage=ready]", { timeout: 60_000 });
await page.keyboard.down("KeyW");
await page.waitForTimeout(12000);
await page.keyboard.up("KeyW");
await dump("play, walking");
await page.keyboard.press("KeyV");
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/screens/sound/play-sound-card-1440x900.jpg" });
await browser.close();
console.log(errors ? `${errors} errors` : "no errors");
