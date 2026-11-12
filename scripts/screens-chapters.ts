/**
 * Captures the chapter beats for review: Chapter 1 from the dome to the stamp.
 * Plays the real critical path with the debug hooks (teleport, then the real
 * interact key), clicking through the story cards, and saves a frame at each
 * beat. Tips are marked done so they do not cover the view.
 *
 *   npx tsx scripts/screens-chapters.ts [folder] [baseUrl]
 *
 * Desktop only, 1440x900 (DECISIONS #41). Needs a running site.
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const [folder = "phase05", baseUrl = "http://localhost:5173"] = process.argv.slice(2);
const outDir = fileURLToPath(new URL(`../docs/screens/${folder}/`, import.meta.url));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.setItem("poh.save.v1", JSON.stringify({ version: 1, world: "home", miloStage: 0, carrying: null, delivered: ["to-the-lamp"], stamps: ["prologue"], flags: ["seen-notebook"] }));
  localStorage.setItem("poh.settings.v1", JSON.stringify({ tips: false, tipsDone: ["move", "look", "arrow", "use", "notebook"] }));
});
await page.goto(`${baseUrl}/?test&quality=low`);
await page.waitForSelector("html[data-stage=ready]", { timeout: 90_000 });
await page.waitForTimeout(1500);

const hook = <T>(code: string): Promise<T> => page.evaluate(`(() => { const p = window.__poh; return ${code}; })()`) as Promise<T>;
const shot = async (name: string): Promise<void> => {
  await page.screenshot({ path: `${outDir}${name}-1440x900.png` });
  console.log(name);
};
const go = async (id: string): Promise<void> => {
  await hook(`p.teleportTo(${JSON.stringify(id)})`);
  await page.waitForTimeout(500);
};
const cards = async (): Promise<void> => {
  while (await page.locator(".card .got").count()) {
    await page.waitForTimeout(500);
    await page.locator(".card .got").click();
    await page.waitForTimeout(350);
  }
};
const use = async (): Promise<void> => {
  await cards();
  await page.keyboard.down("KeyE");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyE");
};
const until = async (test: string, timeout = 30_000, onCard?: () => Promise<void>): Promise<void> => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await hook<boolean>(test)) return;
    if (await page.locator(".card .got").count()) {
      if (onCard) await onCard();
      await cards();
    }
    await page.waitForTimeout(250);
  }
};

await go("dome-tranquility");
await shot("ch1-01-dome");
await use();
await page.waitForTimeout(900);
await shot("ch1-02-countdown");
await until(`p.worldId() === "tranquility"`);
await page.waitForTimeout(2600);
await shot("ch1-03-arrive");
let noted = false;
await until(`p.state().carrying === "a11-letter-descent"`, 40_000, async () => {
  if (!noted) {
    noted = true;
    await shot("ch1-04-dad-note");
  }
});
await go("letter-descent");
await use();
await page.waitForTimeout(2600);
await shot("ch1-05-letter-beat");
let facted = false;
await until(`p.state().carrying === "a11-letter-seismometer"`, 60_000, async () => {
  if (!facted && (await page.locator(".card.fact").count())) {
    facted = true;
    await shot("ch1-06-fact-card");
  }
});
await go("letter-seismometer");
await use();
await until(`p.state().carrying === "a11-letter-mirrors"`, 60_000);
await page.keyboard.press("Space");
await page.waitForTimeout(900);
await shot("ch1-07-seismograph");
await go("letter-lrrr");
await use();
await until(`p.state().flags.includes("send-a-light:started")`, 60_000);
await page.waitForTimeout(1500);
await cards();
await go("frame-turn");
await page.waitForTimeout(800);
await shot("ch1-08-one-mirror");
for (const panel of ["a", "b"]) {
  await go(`mirror-${panel}`);
  await use();
  await page.waitForTimeout(500);
  if (panel === "b") await shot("ch1-09-carry-mirror");
  await go("frame-fit");
  await use();
  await page.waitForTimeout(1800);
}
await shot("ch1-10-corner-home");
await use();
await page.waitForTimeout(2500);
await go("earth-console");
await use();
await page.waitForTimeout(1100);
await shot("ch1-11-pulse");
// The glint starts a moment after the pong comes home.
await until(`p.state().flags.includes("send-a-light:pulse")`, 20_000);
await page.waitForTimeout(2300);
await shot("ch1-12-glint");
await until(`p.state().flags.includes("send-a-light:done")`, 30_000);
await until(`false`, 14_000);
await go("parcel");
await shot("ch1-13-parcel");
await use();
await page.waitForTimeout(600);
await go("lamp-home");
await shot("ch1-14-lamp-home");
await use();
await until(`p.worldId() === "home"`);
await page.waitForTimeout(2000);
await go("milo");
await use();
await page.waitForTimeout(3200);
await shot("ch1-15-milo-eyes");
await until(`p.state().stamps.includes("chapter-1")`, 60_000);
await page.evaluate(() => (document.documentElement.dataset["motion"] = "reduce"));
await page.waitForTimeout(1600);
await shot("ch1-16-stamp");
await page.waitForTimeout(5000);
await shot("ch1-17-workshop-after");
console.log(errors.length ? errors.join("\n") : "no console errors");
await browser.close();
