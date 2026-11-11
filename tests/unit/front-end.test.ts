import { describe, expect, it } from "vitest";
import { renderPages } from "../../scripts/vite/pages-plugin";
import { listHtml, wobble } from "../../scripts/vite/loader-plugin";
import { BootProgress } from "../../src/boot/progress";
import { fact } from "../../src/content/facts";
import { LETTER_TO_THE_LAMP, SEEN_NOTEBOOK, TIP_ORDER, goalFor, tipFor } from "../../src/content/goals";
import { GUIDE } from "../../src/content/guide";
import { PLACE_COPY, PLACE_IDS, placeFlag, placesFound } from "../../src/content/places";
import { STORY } from "../../src/content/story";
import { STORY_ART } from "../../src/ui/title/StoryArt";
import { PATHS, PLACES, TRAIL_SPECS, sampleTrail } from "../../src/game/worlds/home/layout";
import { createInitialState, reviveState } from "../../src/game/core/state";
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

describe("goals and tips", () => {
  const fresh = createInitialState();
  const key = (code: string): string => (code.startsWith("Key") ? code.slice(3) : code);
  const bindings = { forward: ["KeyW"], back: ["KeyS"], left: ["KeyA"], right: ["KeyD"], run: ["ShiftLeft"], interact: ["KeyE"] };

  it("always names one next step, in story order", () => {
    expect(goalFor(fresh, "keyboard").id).toBe("mailbox");
    expect(goalFor({ ...fresh, carrying: LETTER_TO_THE_LAMP }, "keyboard").id).toBe("lamp");
    const delivered = { ...fresh, delivered: [LETTER_TO_THE_LAMP] };
    expect(goalFor(delivered, "keyboard").id).toBe("notebook");
    expect(goalFor({ ...delivered, flags: [SEEN_NOTEBOOK] }, "keyboard").id).toBe("explore");
  });

  it("tells each device how to open the notebook", () => {
    const delivered = { ...fresh, delivered: [LETTER_TO_THE_LAMP] };
    expect(goalFor(delivered, "keyboard").detail).toContain("Press N");
    expect(goalFor(delivered, "touch").detail).toContain("Tap Notebook");
    expect(goalFor(delivered, "gamepad").detail).toContain("View");
  });

  it("draws the player's own keys, and uses plain words with no em dashes", () => {
    const move = tipFor("move", "keyboard", { ...bindings, forward: ["KeyZ"] }, key);
    expect(move.keys).toEqual(["Z", "A", "S", "D"]);
    for (const device of ["keyboard", "touch", "gamepad"] as const) {
      for (const id of TIP_ORDER) expect(tipFor(id, device, bindings, key).text).not.toMatch(/—/);
      for (const state of [fresh, { ...fresh, carrying: LETTER_TO_THE_LAMP }]) {
        const goal = goalFor(state, device);
        expect(`${goal.title} ${goal.detail} ${goal.hint}`).not.toMatch(/—/);
      }
    }
  });

  it("keeps story flags in the save, and old saves start with none", () => {
    expect(reviveState({ ...fresh, flags: [SEEN_NOTEBOOK, SEEN_NOTEBOOK] }).flags).toEqual([SEEN_NOTEBOOK]);
    const { flags: _drop, ...old } = fresh;
    expect(reviveState(old).flags).toEqual([]);
  });

  it("remembers learned tips and drops junk", () => {
    expect(defaultSettings().tips).toBe(true);
    expect(reviveSettings({ tipsDone: ["move", 3, "look"] }).tipsDone).toEqual(["move", "look"]);
  });
});

describe("places on Home", () => {
  it("names every place the world can report, and nothing else", () => {
    expect(PLACES.map((p) => p.id).sort()).toEqual([...PLACE_IDS].sort());
  });

  it("keeps place copy short and plain", () => {
    for (const { name, line } of Object.values(PLACE_COPY)) {
      expect(name.length).toBeLessThanOrEqual(22);
      expect(line.split(" ").length).toBeLessThanOrEqual(14);
      expect(`${name} ${line}`).not.toMatch(/[—–]/);
      expect(line).not.toMatch(/\d/);
    }
  });

  it("counts found places for the explore goal", () => {
    const state = { ...createInitialState(), delivered: [LETTER_TO_THE_LAMP], flags: [SEEN_NOTEBOOK, placeFlag("pond"), placeFlag("camp"), "place:nowhere"] };
    expect(placesFound(state.flags)).toBe(2);
    expect(goalFor(state, "keyboard").detail).toContain(`2 of ${PLACE_IDS.length}`);
    const all = { ...state, flags: [SEEN_NOTEBOOK, ...PLACE_IDS.map(placeFlag)] };
    expect(goalFor(all, "keyboard").title).toBe("You found every place");
  });

  it("gives places room: no two place centers closer than 8 m", () => {
    for (let i = 0; i < PLACES.length; i += 1) {
      for (let j = i + 1; j < PLACES.length; j += 1) {
        const meters = Math.acos(Math.min(1, PLACES[i]!.dir.dot(PLACES[j]!.dir))) * 20;
        expect(meters, `${PLACES[i]!.id} to ${PLACES[j]!.id}`).toBeGreaterThan(8);
      }
    }
  });

  it("draws trails as smooth curves that join end to end", () => {
    for (const spec of TRAIL_SPECS) {
      const points = sampleTrail(spec, 0.5);
      expect(points[0]!.distanceTo(spec.a)).toBeLessThan(1e-6);
      expect(points.at(-1)!.distanceTo(spec.b)).toBeLessThan(1e-6);
      // No kinks: each step turns only a little from the one before.
      for (let i = 2; i < points.length; i += 1) {
        const a = points[i - 1]!.clone().sub(points[i - 2]!).normalize();
        const b = points[i]!.clone().sub(points[i - 1]!).normalize();
        expect(a.dot(b)).toBeGreaterThan(0.97);
      }
    }
    expect(PATHS.length).toBeGreaterThan(TRAIL_SPECS.length);
  });
});

describe("the opening story", () => {
  it("has a drawing for every page, short plain lines and no em dashes or numbers", () => {
    expect(STORY.pages.length).toBeGreaterThanOrEqual(4);
    for (const page of STORY.pages) {
      expect(STORY_ART[page.art]).toBeDefined();
      expect(page.text).not.toMatch(/—/);
      expect(page.text).not.toMatch(/[0-9]/);
      expect(page.text.split(/\s+/).length).toBeLessThanOrEqual(28);
    }
    for (const word of [STORY.label, STORY.next, STORY.begin, STORY.skip]) expect(word).not.toMatch(/—/);
  });
});
