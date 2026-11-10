import { describe, expect, it } from "vitest";
import { renderPages } from "../../scripts/vite/pages-plugin";
import { listHtml, wobble } from "../../scripts/vite/loader-plugin";
import { BootProgress } from "../../src/boot/progress";
import { fact } from "../../src/content/facts";
import { GUIDE } from "../../src/content/guide";
import { SPREADS, factText, isComplete } from "../../src/content/notebook";
import { GLYPHS, glyphShapes, letterGeometry, signedArea, traceGlyph } from "../../src/game/title/letters";
import { ROOM_WORDS, makeRoomCode } from "../../src/net/words";
import { defaultSettings, reviveSettings } from "../../src/ui/settings-data";
import facts from "../../src/data/facts.json";

describe("title letters", () => {
  it("every glyph is one solid piece, so no letter falls apart into corners", () => {
    for (const letter of Object.keys(GLYPHS)) {
      const outers = traceGlyph(GLYPHS[letter]!).filter((loop) => signedArea(loop) > 0);
      expect(outers, letter).toHaveLength(1);
    }
  });

  it("finds the holes in P and O and none in the others", () => {
    expect(glyphShapes("P")[0]!.holes).toHaveLength(1);
    expect(glyphShapes("O")[0]!.holes).toHaveLength(1);
    expect(glyphShapes("H")[0]!.holes).toHaveLength(0);
  });

  it("builds a bevelled letter that stands on the baseline", () => {
    const geometry = letterGeometry("E", 0.5, 0.9);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeCloseTo(2.5, 1);
    expect(box.max.x).toBeCloseTo(-box.min.x, 3);
  });
});

describe("loading progress", () => {
  it("weights tasks and never goes backward", () => {
    const seen: number[] = [];
    const boot = new BootProgress((v) => seen.push(v));
    const a = boot.task(3);
    const b = boot.task(1);
    a.set(0.5);
    a.set(0.2);
    expect(boot.value).toBeCloseTo(0.375);
    b.done();
    a.done();
    expect(boot.complete).toBe(true);
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1]!)).toBe(true);
  });

  it("calls a task's done hook once", () => {
    let calls = 0;
    const boot = new BootProgress(() => undefined);
    const t = boot.task(1, () => (calls += 1));
    t.set(1);
    t.done();
    expect(calls).toBe(1);
  });

  it("builds the loader list from checked facts", () => {
    const html = listHtml(facts.facts as never);
    expect(html).toContain(fact("a11-lrrr-cubes").short!);
    expect(html).not.toContain("—");
    expect(wobble("M10 10 L 20 20", () => 0.5, 1)).toBe("M10.0 10.0 L 20.0 20.0");
  });
});

describe("settings", () => {
  it("falls back to safe defaults for anything odd", () => {
    expect(reviveSettings(null)).toEqual(defaultSettings());
    const s = reviveSettings({ textSize: "huge", motion: "reduce", volume: { music: 4, voices: "loud" }, exploreFreely: true });
    expect(s.textSize).toBe("m");
    expect(s.motion).toBe("reduce");
    expect(s.volume.music).toBe(1);
    expect(s.volume.voices).toBe(defaultSettings().volume.voices);
    expect(s.exploreFreely).toBe(true);
  });
});

describe("room codes", () => {
  it("are three different list words and a number", () => {
    for (let i = 0; i < 50; i += 1) {
      const parts = makeRoomCode().split("-");
      expect(parts).toHaveLength(4);
      expect(new Set(parts.slice(0, 3)).size).toBe(3);
      for (const word of parts.slice(0, 3)) expect(ROOM_WORDS).toContain(word);
      expect(Number(parts[3])).toBeGreaterThanOrEqual(1);
      expect(Number(parts[3])).toBeLessThanOrEqual(99);
    }
  });
});

describe("notebook and Field Guide", () => {
  it("words the Voyager light-day fact for the day it is read", () => {
    const v1 = fact("v1-light-day");
    expect(factText(v1, new Date("2020-01-01"))).toMatch(/becomes/);
    expect(factText(v1, new Date("2030-01-01"))).toMatch(/became/);
  });

  it("inks a page when its letter or stamp is in the save", () => {
    const lamp = SPREADS.find((s) => s.id === "lamp")!;
    expect(isComplete(lamp, { delivered: [], stamps: [] })).toBe(false);
    expect(isComplete(lamp, { delivered: ["to-the-lamp"], stamps: [] })).toBe(true);
  });

  it("the Field Guide has every machine, every source and no em dashes", () => {
    const html = renderPages.guide(new Date("2026-11-11"));
    for (const spread of SPREADS) expect(html).toContain(spread.nickname.replace(/'/g, "&#39;").replace(/&#39;/g, "'"));
    for (const spread of SPREADS) for (const f of [...spread.learned, ...spread.thenNow, ...spread.deeper]) expect(html).toContain(f.sourceUrl);
    for (const spread of SPREADS) for (const image of spread.images) expect(html).toContain(image.credit.replace(/&/g, "&amp;"));
    expect(html).toContain(GUIDE.sketch);
    expect(html).not.toMatch(/—/);
  });

  it("the About page has the note for grown-ups", () => {
    const html = renderPages.about();
    expect(html).toContain("For grown-ups");
    expect(html).not.toMatch(/—/);
  });
});
