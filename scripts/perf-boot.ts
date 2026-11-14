/**
 * Boot performance probe: GPU Chrome, real intro. Records long tasks and
 * rAF frame gaps from page load through the loader, the light, the title
 * flight, the menu, New story and the story intro.
 *
 *   npx tsx scripts/perf-boot.ts [url] [outdir] [gpu|cpu]
 *
 * PROFILE=1 adds a CPU profile per stretch, KEYS=1 lists shader programs that
 * compile in each stretch, LIGHTS=1 lists the lights (a change in their count
 * recompiles every shader).
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [url = "http://localhost:5173", out = ".", mode = "gpu"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const args =
  mode === "gpu"
    ? ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--enable-features=Vulkan", "--autoplay-policy=no-user-gesture-required"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.log(`  [${m.type()}]`, m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("  page error:", String(e)));
await page.addInitScript(`
  window.__perf = { long: [], gaps: [], marks: [] };
  try { new PerformanceObserver(function (list) { for (const e of list.getEntries()) window.__perf.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); } catch (e) {}
  var last = performance.now();
  function tick(t) { var gap = t - last; if (gap > 34) window.__perf.gaps.push([Math.round(t), Math.round(gap)]); last = t; requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
  document.addEventListener("DOMContentLoaded", function () { new MutationObserver(function () { window.__perf.marks.push([document.documentElement.dataset.stage, Math.round(performance.now())]); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-stage"] }); });
`);
const cdp = await context.newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
const t0 = Date.now();
await page.goto(`${url}/?intro&test&debug`);
const gl = await page.evaluate(() => {
  const c = document.createElement("canvas").getContext("webgl2");
  const i = c?.getExtension("WEBGL_debug_renderer_info");
  return i ? String(c!.getParameter(i.UNMASKED_RENDERER_WEBGL)) : "?";
});
console.log("renderer:", gl);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/a-loader.png` });
await page.waitForSelector("html[data-stage=waiting]", { timeout: 120_000 });
console.log("waiting after", Date.now() - t0, "ms");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/b-ready.png` });
type Node = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };
const analyse = async (label: string): Promise<void> => {
  const { profile } = (await cdp.send("Profiler.stop")) as { profile: { nodes: Node[]; samples: number[]; timeDeltas: number[]; startTime: number } };
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map<string, number>();
  const total = new Map<string, number>();
  let t = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i + 1] ?? 200) / 1000;
    const n = byId.get(profile.samples[i]!)!;
    const key = (x: Node): string => `${x.callFrame.functionName || "(anon)"} ${x.callFrame.url.split("/").slice(-2).join("/").split("?")[0]}:${x.callFrame.lineNumber}`;
    if (n.callFrame.functionName === "(idle)" || n.callFrame.functionName === "(program)") continue;
    self.set(key(n), (self.get(key(n)) ?? 0) + dt);
    const seen = new Set<string>();
    let cur: number | undefined = n.id;
    while (cur !== undefined) {
      const k = key(byId.get(cur)!);
      if (!seen.has(k)) total.set(k, (total.get(k) ?? 0) + dt);
      seen.add(k);
      cur = parent.get(cur);
    }
    t += dt;
  }
  const top = (m: Map<string, number>, n: number): string => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `    ${v.toFixed(0).padStart(6)} ms  ${k}`).join(String.fromCharCode(10));
  console.log(`-- profile ${label}: busy ${t.toFixed(0)} ms`);
  console.log("  self:");
  console.log(top(self, 18));
  console.log("  total:");
  console.log(top(total, 40));
  await cdp.send("Profiler.start");
};
let known = new Set<string>();
const report = async (label: string): Promise<void> => {
  if (process.env.PROFILE) await analyse(label);
  const progs = (await page.evaluate(() => (window as any).__poh?.programs?.() ?? [])) as string[];
  const fresh = progs.filter((p) => !known.has(p));
  known = new Set(progs);
  console.log(`   programs ${progs.length}, new ${fresh.length}:`);
  if (process.env.LIGHTS) console.log((await page.evaluate(() => (window as any).__poh?.lights?.() ?? [])).join(String.fromCharCode(10)));
  const counts = new Map<string, number>();
  for (const f of fresh) { const k = f.split("|")[0]!; counts.set(k, (counts.get(k) ?? 0) + 1); }
  console.log("    ", JSON.stringify([...counts]));
  if (process.env.KEYS) for (const f of fresh) console.log("      ", f.slice(0, 400));
  const p = await page.evaluate(() => {
    const w = window as unknown as { __perf: { long: [number, number][]; gaps: [number, number][]; marks: [string, number][] } };
    const r = JSON.parse(JSON.stringify(w.__perf));
    w.__perf.long = [];
    w.__perf.gaps = [];
    return r;
  });
  const longSum = p.long.reduce((s: number, [, d]: [number, number]) => s + d, 0);
  const bigGaps = p.gaps.filter(([, g]: [number, number]) => g > 50);
  console.log(`== ${label}: long tasks ${p.long.length} (${longSum} ms), worst ${JSON.stringify(p.long.sort((a: number[], b: number[]) => b[1]! - a[1]!).slice(0, 6))}`);
  console.log(`   frame gaps >34ms: ${p.gaps.length}, >50ms: ${bigGaps.length}, worst ${JSON.stringify(p.gaps.sort((a: number[], b: number[]) => b[1]! - a[1]!).slice(0, 6))}`);
  console.log(`   marks ${JSON.stringify(p.marks)}`);
};
await report("boot to waiting");
await page.keyboard.press("Space");
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/c-flood.png` });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/d-flight.png` });
await page.waitForFunction(() => (window as any).__poh.titlePhase() === "waiting", null, { timeout: 60_000 });
await report("title flight");
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/e-title.png` });
await page.locator(".chain").focus();
await page.keyboard.press("Enter");
await page.waitForSelector("html[data-stage=menu]");
await page.waitForTimeout(1500);
await report("chain to menu");
await page.screenshot({ path: `${out}/f-menu.png` });
await page.getByRole("button", { name: "New story" }).click();
await page.waitForTimeout(400);
const confirm = page.getByRole("button", { name: /Start|Yes|New story/ }).last();
if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => undefined);
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/g-story-${i}.png` });
  await page.keyboard.press("ArrowRight");
}
await page.waitForTimeout(2500);
await report("story");
await page.screenshot({ path: `${out}/h-after.png` });
const fps = await page.evaluate(() => document.querySelector(".debug, [class*=debug]")?.textContent ?? "");
console.log("debug:", fps.replace(/\s+/g, " ").slice(0, 120));
await browser.close();
