import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../../src/content/chapters";
import { FINALE_BEGUN, FINALE_ENDED, FINALE_HEARD, RECORD, V1_LETTER, finaleOpen, finaleStep } from "../../src/content/finale";
import { goalFor } from "../../src/content/goals";
import type { GameState } from "../../src/game/core/state";

const base: GameState = {
  version: 1,
  world: "home",
  miloStage: 3,
  carrying: null,
  delivered: ["to-the-lamp"],
  stamps: ["prologue", ...CHAPTERS.map((c) => c.id)],
  flags: ["seen-notebook"],
} as GameState;
const at = (change: Partial<GameState>): GameState => ({ ...base, ...change });

describe("Finale steps", () => {
  it("opens only once every built chapter has its stamp", () => {
    expect(finaleOpen(base)).toBe(true);
    expect(finaleOpen(at({ stamps: ["prologue"] }))).toBe(false);
    expect(finaleStep(at({ stamps: ["prologue"] }))).toBe("closed");
  });

  it("walks from the mailbox to the museum", () => {
    expect(finaleStep(base)).toBe("mailbox");
    expect(finaleStep(at({ carrying: V1_LETTER }))).toBe("dish");
    expect(finaleStep(at({ delivered: ["to-the-lamp", V1_LETTER] }))).toBe("record-take");
    expect(finaleStep(at({ delivered: ["to-the-lamp", V1_LETTER], carrying: RECORD }))).toBe("record-give");
    expect(finaleStep(at({ delivered: ["to-the-lamp", V1_LETTER], miloStage: 5 }))).toBe("listen");
    expect(finaleStep(at({ delivered: ["to-the-lamp", V1_LETTER], miloStage: 5, flags: [FINALE_BEGUN, FINALE_HEARD] }))).toBe("page");
    expect(finaleStep(at({ miloStage: 5, stamps: [...base.stamps, "finale"] }))).toBe("ending");
    expect(finaleStep(at({ miloStage: 5, stamps: [...base.stamps, "finale"], flags: [FINALE_ENDED] }))).toBe("museum");
  });

  it("shows the Finale on the goal card", () => {
    const goal = goalFor(base, "keyboard");
    expect(goal.chapter).toBe("Finale: The Long Light");
    expect(goal.title).toBe("Check the mailbox");
    expect(goalFor(at({ carrying: V1_LETTER }), "keyboard").title).toBe("Take the letter to Dad's dish");
  });

  it("keeps player copy free of em dashes and bare numbers", async () => {
    const copy = await import("../../src/content/finale");
    // Every string a player reads (pauses and game ids are not text).
    const strings: string[] = [];
    const walk = (v: unknown, key = ""): void => {
      if (typeof v === "string" && key !== "game" && key !== "who" && key !== "at") strings.push(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk([copy.FINALE_COPY, copy.FINALE_BEGINS, copy.LETTER_TAKEN, copy.AIM_START, copy.RECORD_FITTED, copy.MESSAGES, copy.ENDING, copy.STAMP, copy.NAME_WORDS]);
    const text = strings.join(" | ");
    expect(text).not.toContain("—");
    // Numbers a player sees come from facts; the Finale's own copy has none (Voyager 1 is a name).
    expect(text.replaceAll("Voyager 1", "")).not.toMatch(/\d/);
  });
});
