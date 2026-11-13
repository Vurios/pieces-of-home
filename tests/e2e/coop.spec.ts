import { type Browser, type Page, expect, test } from "@playwright/test";
import { testRoom } from "./rooms";

/**
 * Co-op (Phase 06), against `npm run dev` with the real Room Durable Object.
 * Each page draws the whole game on the CPU, so these tests are patient.
 */

interface Friend {
  seat: number;
  kid: string;
  world: string | null;
  visible: boolean;
}
interface Net {
  status: string;
  room: string | null;
  players: number;
  you: number | null;
  kid: string;
  seats: { seat: number; kid: string; online: boolean }[];
  friends: Friend[];
  heard: string[];
  stats: { sent: number; received: number };
}
interface State {
  delivered: string[];
  stamps: string[];
  flags: string[];
  miloStage: number;
  carrying: string | null;
}
type Poh = {
  net(): Net;
  state(): State;
  patch(change: Partial<State>): void;
  emit(name: string, payload: unknown): void;
  worldId(): string | null;
  drop(): void;
};

test.describe.configure({ mode: "default" });

const AFTER_PROLOGUE = { version: 1, world: "home", miloStage: 0, carrying: null, delivered: ["to-the-lamp"], stamps: ["prologue"], flags: ["seen-notebook"] };

const net = (page: Page): Promise<Net> => page.evaluate(() => (window as unknown as { __poh: Poh }).__poh.net());
const state = (page: Page): Promise<State> => page.evaluate(() => (window as unknown as { __poh: Poh }).__poh.state());

async function open(browser: Browser, room: string, save: object | null, errors: string[]): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/WebSocket/.test(m.text()) && errors.push(m.text()));
  if (save) {
    await page.addInitScript((s) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("poh.save.v1", JSON.stringify(s));
        sessionStorage.setItem("seeded", "1");
      }
    }, save);
  }
  await page.goto(`/?room=${room}&test&quality=low`);
  await expect(page.locator("html")).toHaveAttribute("data-stage", "ready", { timeout: 90_000 });
  await expect(page.locator("html")).toHaveAttribute("data-net", "connected", { timeout: 60_000 });
  return page;
}

async function sees(page: Page, kid: string, timeout = 30_000): Promise<void> {
  await expect.poll(async () => (await net(page)).friends.some((f) => f.kid === kid && f.visible), { timeout, message: `sees ${kid}` }).toBe(true);
}

test("two players share a room: kids, moves, emotes, story, a late joiner and a reconnect", async ({ browser }, info) => {
  test.skip(info.project.name === "phone", "the co-op tests run on desktop");
  test.setTimeout(600_000);
  const errors: string[] = [];
  const room = testRoom(11);

  // The first player brings their story (the prologue is done); the second is brand new.
  const a = await open(browser, room, AFTER_PROLOGUE, errors);
  const b = await open(browser, room, null, errors);
  await expect(a.locator("html")).toHaveAttribute("data-players", "2", { timeout: 30_000 });

  // Character select: Remi went to the first player; the second gets the next free kid.
  expect((await net(a)).kid).toBe("remi");
  expect((await net(b)).kid).toBe("nori");
  // The newcomer's save now holds the room's story.
  await expect.poll(async () => (await state(b)).stamps, { timeout: 15_000 }).toContain("prologue");

  // They see each other standing in the same world, even without moving.
  await sees(a, "nori");
  await sees(b, "remi");

  // Movement budget: nothing while standing still, about eight a second at most while walking.
  const idle0 = (await net(a)).stats.sent;
  await a.waitForTimeout(3000);
  const idle = (await net(a)).stats.sent - idle0;
  expect(idle, "messages while idle").toBeLessThanOrEqual(1);
  const walk0 = (await net(a)).stats.sent;
  const t0 = Date.now();
  await a.keyboard.down("KeyW");
  await a.waitForTimeout(3000);
  await a.keyboard.up("KeyW");
  const walkRate = ((await net(a)).stats.sent - walk0) / ((Date.now() - t0) / 1000);
  info.annotations.push({ type: "budget", description: `idle ${idle} in 3 s, walking ${walkRate.toFixed(1)} per s` });
  expect(walkRate, "messages per second while walking").toBeLessThanOrEqual(9);
  expect(walkRate).toBeGreaterThan(2);

  // An emote and a phrase arrive as ids.
  await a.evaluate(() => (window as unknown as { __poh: Poh }).__poh.emit("emote", { id: "wave" }));
  await a.evaluate(() => (window as unknown as { __poh: Poh }).__poh.emit("phrase", { id: "thanks" }));
  await expect.poll(async () => (await net(b)).heard, { timeout: 15_000 }).toEqual(expect.arrayContaining(["e:wave", "ph:thanks"]));

  // A delivered letter and Milo's new part reach the other player's save.
  await b.evaluate(() => (window as unknown as { __poh: Poh }).__poh.patch({ delivered: ["to-the-lamp", "a11-letter-descent"], miloStage: 1, flags: ["seen-notebook", "chapter-1:arrived"] }));
  await expect.poll(async () => (await state(a)).delivered, { timeout: 15_000 }).toContain("a11-letter-descent");
  await expect.poll(async () => (await state(a)).miloStage, { timeout: 15_000 }).toBe(1);
  // A story moment plays for everyone: the event travels as ids.
  await b.evaluate(() => (window as unknown as { __poh: Poh }).__poh.emit("activity:beat", { id: "send-a-light", beat: "first-mirror" }));
  await expect.poll(async () => (await net(a)).heard, { timeout: 15_000 }).toContain("ev:activity:beat:send-a-light");

  // A late joiner gets the whole story at once and arrives next to the group.
  const c = await open(browser, room, null, errors);
  expect((await net(c)).kid).toBe("lumi");
  const late = await state(c);
  expect(late.delivered).toEqual(expect.arrayContaining(["to-the-lamp", "a11-letter-descent"]));
  expect(late.miloStage).toBe(1);
  await sees(c, "remi");
  await sees(c, "nori");
  await sees(a, "lumi");

  // A dropped connection comes back with the same kid.
  await b.evaluate(() => (window as unknown as { __poh: Poh }).__poh.drop());
  await expect.poll(async () => (await net(b)).status, { timeout: 30_000 }).toBe("connected");
  expect((await net(b)).kid).toBe("nori");
  // Leaving goes back to solo as Remi, and the story stays in the save.
  await c.evaluate(() => (window as unknown as { __poh: { leave(): void } }).__poh.leave());
  expect((await net(c)).status).toBe("solo");
  expect((await net(c)).kid).toBe("remi");
  expect((await state(c)).delivered).toContain("a11-letter-descent");
  await expect(a.locator("html")).toHaveAttribute("data-players", "2", { timeout: 30_000 });
  await c.close();

  // A reload of the page (the same tab) comes back as the same kid too.
  await b.reload();
  await expect(b.locator("html")).toHaveAttribute("data-net", "connected", { timeout: 180_000 });
  expect((await net(b)).kid).toBe("nori");
  await expect(a.locator("html")).toHaveAttribute("data-players", "2", { timeout: 30_000 });

  expect(errors).toEqual([]);
  for (const page of [a, b]) await page.close();
});

test("a full room says so, and junk never reaches anyone", async ({ browser }, info) => {
  test.skip(info.project.name === "phone", "the co-op tests run on desktop");
  test.setTimeout(240_000);
  const errors: string[] = [];
  const room = testRoom(12);
  const a = await open(browser, room, null, errors);
  // Three more players with plain sockets fill the room; a fifth is turned away.
  const result = await a.evaluate(async (code) => {
    const url = `${location.origin.replace("http", "ws")}/parties/room/${code}`;
    const say = (ws: WebSocket, m: object): void => ws.send(JSON.stringify(m));
    const hello = (sid: string) => ({ t: "hi", s: sid, k: "remi", p: { d: [], s: [], f: [], m: 0 }, w: "home" });
    const connect = (sid: string): Promise<{ ws: WebSocket; first: unknown }> =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.onopen = () => say(ws, hello(sid));
        ws.onmessage = (e) => resolve({ ws, first: JSON.parse(String(e.data)) });
        ws.onerror = () => reject(new Error("socket error"));
      });
    const others = [];
    for (const sid of ["testseatone01", "testseattwo02", "testseattre03"]) others.push(await connect(sid));
    const fifth = await connect("testseatfiv04");
    // Junk and free text from a player in the room: dropped, never relayed.
    say(others[0]!.ws, { t: "chat", text: "hello" });
    say(others[0]!.ws, { t: "ph", i: "my name is" });
    say(others[0]!.ws, { t: "e", i: "wave" });
    await new Promise((r) => setTimeout(r, 1500));
    for (const o of others) o.ws.close();
    return { kids: others.map((o) => (o.first as { k?: string }).k), fifth: (fifth.first as { t: string }).t };
  }, room);
  expect(result.fifth).toBe("full");
  expect(new Set(result.kids).size).toBe(3);
  expect(result.kids).not.toContain("remi");
  await expect.poll(async () => (await net(a)).heard, { timeout: 10_000 }).toEqual(["e:wave"]);
  expect(errors).toEqual([]);
  await a.close();
});

test("when co-op is resting, the game says so kindly and plays solo", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "the co-op tests run on desktop");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // Every room socket is refused, like a server at its daily limit.
  await page.routeWebSocket(/\/parties\//, (ws) => ws.close({ code: 1011, reason: "resting" }));
  await page.goto(`/?room=${testRoom(13)}&test&quality=low`);
  await expect(page.locator("html")).toHaveAttribute("data-stage", "ready", { timeout: 90_000 });
  await expect(page.locator("html")).toHaveAttribute("data-net", "offline", { timeout: 60_000 });
  await expect(page.getByText("Co-op is resting right now. You can keep playing solo.").first()).toBeVisible({ timeout: 10_000 });
  // Solo still works: the save, the world and the kid are all there.
  expect(await page.evaluate(() => (window as unknown as { __poh: Poh }).__poh.worldId())).toBe("home");
  expect((await net(page)).kid).toBe("remi");
  expect(errors).toEqual([]);
});

test("four players see each other", async ({ browser }, info) => {
  test.skip(info.project.name === "phone", "the co-op tests run on desktop");
  test.setTimeout(600_000);
  const errors: string[] = [];
  const room = testRoom(14);
  const pages: Page[] = [];
  for (let i = 0; i < 4; i += 1) pages.push(await open(browser, room, i === 0 ? AFTER_PROLOGUE : null, errors));
  const kids = await Promise.all(pages.map(async (p) => (await net(p)).kid));
  expect(new Set(kids).size).toBe(4);
  for (const page of pages) {
    await expect(page.locator("html")).toHaveAttribute("data-players", "4", { timeout: 60_000 });
    for (const kid of kids) if (kid !== (await net(page)).kid) await sees(page, kid, 60_000);
  }
  expect(errors).toEqual([]);
  for (const page of pages) await page.close();
});

test("everyone goes through the Looking Lamp together", async ({ browser }, info) => {
  test.skip(info.project.name === "phone", "the co-op tests run on desktop");
  test.setTimeout(420_000);
  const errors: string[] = [];
  const room = testRoom(15);
  const a = await open(browser, room, AFTER_PROLOGUE, errors);
  const b = await open(browser, room, null, errors);
  const world = (page: Page): Promise<string | null> => page.evaluate(() => (window as unknown as { __poh: Poh }).__poh.worldId());
  // One player looks into the Moon dome: the other follows through the lamp.
  await a.evaluate(() => (window as unknown as { __poh: Poh }).__poh.emit("travel", { to: "tranquility", entry: "lamp" }));
  await expect.poll(() => world(a), { timeout: 120_000 }).toBe("tranquility");
  await expect.poll(() => world(b), { timeout: 120_000 }).toBe("tranquility");
  await sees(a, "nori", 60_000);
  await sees(b, "remi", 60_000);
  // And home again, together.
  await b.evaluate(() => (window as unknown as { __poh: Poh }).__poh.emit("travel", { to: "home", entry: "bench" }));
  await expect.poll(() => world(b), { timeout: 120_000 }).toBe("home");
  await expect.poll(() => world(a), { timeout: 120_000 }).toBe("home");
  expect(errors).toEqual([]);
  for (const page of [a, b]) await page.close();
});
