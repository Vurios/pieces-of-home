/**
 * Frame cost in play: walks Remi round the home planet for a few seconds on
 * Chrome with the graphics chip and prints a CPU profile of the frame loop,
 * the scene's object counts and the draw stats.
 *
 *   npx tsx scripts/perf-play.ts [url] [quality]
 *
 * Needs a running site (`npm run dev` for readable names).
 */
import { chromium } from "@playwright/test";

const [url = "http://localhost:5173", quality = "high"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("page error:", String(e)));
await page.goto(`${url}/?test&quality=${quality}`);
await page.waitForSelector("html[data-stage=ready]", { timeout: 120_000 });
await page.waitForTimeout(2500);
const counts = await page.evaluate(() => (window as unknown as { __poh: { census(): unknown } }).__poh.census?.() ?? null);
console.log("census", JSON.stringify(counts));
const cdp = await context.newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
await cdp.send("Profiler.start");
// A plain string, so the TypeScript runner adds no helpers the page does not have.
const frames = (await page.evaluate(`new Promise((resolve) => {
  const times = [];
  let last = performance.now();
  function tick(t) { times.push(t - last); last = t; if (times.length < 400) requestAnimationFrame(tick); else resolve(times); }
  requestAnimationFrame(tick);
})`)) as number[];
await page.keyboard.down("KeyW");
await page.waitForTimeout(3000);
await page.keyboard.up("KeyW");
type Node = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };
const { profile } = (await cdp.send("Profiler.stop")) as { profile: { nodes: Node[]; samples: number[]; timeDeltas: number[] } };
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map<number, number>();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map<string, number>();
const total = new Map<string, number>();
let busy = 0;
const key = (x: Node): string => `${x.callFrame.functionName || "(anon)"} ${x.callFrame.url.split("/").slice(-2).join("/").split("?")[0]}:${x.callFrame.lineNumber}`;
for (let i = 0; i < profile.samples.length; i++) {
  const dt = (profile.timeDeltas[i + 1] ?? 100) / 1000;
  const n = byId.get(profile.samples[i]!)!;
  if (n.callFrame.functionName === "(idle)" || n.callFrame.functionName === "(program)") continue;
  busy += dt;
  self.set(key(n), (self.get(key(n)) ?? 0) + dt);
  const seen = new Set<string>();
  for (let cur: number | undefined = n.id; cur !== undefined; cur = parent.get(cur)) {
    const k = key(byId.get(cur)!);
    if (!seen.has(k)) total.set(k, (total.get(k) ?? 0) + dt);
    seen.add(k);
  }
}
const top = (m: Map<string, number>, n: number): string =>
  [...m]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `  ${v.toFixed(0).padStart(6)} ms  ${k}`)
    .join(String.fromCharCode(10));
const sorted = [...frames].sort((a, b) => a - b);
console.log(`frames: median ${sorted[sorted.length >> 1]!.toFixed(1)} ms, p95 ${sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1)} ms`);
console.log(`busy ${busy.toFixed(0)} ms over the walk`);
console.log("self:");
console.log(top(self, 22));
console.log("total:");
console.log(top(total, 40));
console.log("stats", JSON.stringify(await page.evaluate(() => (window as unknown as { __poh: { stats(): unknown } }).__poh.stats())));
await browser.close();
