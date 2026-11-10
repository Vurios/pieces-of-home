/**
 * Times the loader on a throttled connection: first paint, first contentful
 * paint, and how long until "Turn on the light" can be pressed.
 *
 *   npx tsx scripts/measure-loader.ts [url] [profile]
 *
 * `profile` is "4g" (default: 9 Mbps down, 1.5 up, 60 ms) or "3g" (1.6 Mbps,
 * 0.75 up, 150 ms), close to the Lighthouse presets. Uses a fresh cache.
 */
import { chromium } from "@playwright/test";

const [url = "https://piecesofhome.pages.dev/", profile = "4g"] = process.argv.slice(2);
const NETWORKS = {
  "4g": { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  "3g": { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (0.75 * 1024 * 1024) / 8 },
} as const;
const network = NETWORKS[profile as keyof typeof NETWORKS] ?? NETWORKS["4g"];

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
await cdp.send("Network.emulateNetworkConditions", { offline: false, ...network });

let bytes = 0;
page.on("response", async (response) => {
  const length = Number(response.headers()["content-length"] ?? 0);
  bytes += Number.isFinite(length) ? length : 0;
});

const start = Date.now();
await page.goto(url, { waitUntil: "commit" });
await page.waitForSelector("#boot[data-prompt]", { timeout: 180_000 });
const prompt = Date.now() - start;
const paints = await page.evaluate(() => Object.fromEntries(performance.getEntriesByType("paint").map((e) => [e.name, Math.round(e.startTime)])));
const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return n ? { ttfb: Math.round(n.responseStart), html: Math.round(n.responseEnd), domInteractive: Math.round(n.domInteractive) } : null;
});

console.log(`url: ${url}`);
console.log(`network: ${profile}`);
console.log(`first paint: ${paints["first-paint"] ?? "?"} ms`);
console.log(`first contentful paint: ${paints["first-contentful-paint"] ?? "?"} ms`);
console.log(`html: ttfb ${nav?.ttfb} ms, done ${nav?.html} ms, dom interactive ${nav?.domInteractive} ms`);
console.log(`"Turn on the light" ready: ${prompt} ms (includes the 1.2 s settle after loading)`);
console.log(`bytes (by content-length, compressed where sent): ${(bytes / 1024 / 1024).toFixed(2)} MB`);
await browser.close();
