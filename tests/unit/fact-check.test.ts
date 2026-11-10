import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Fact, checkFacts, findFactReferences } from "../../scripts/lib/fact-check";

function fact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: "a11-lrrr-cubes",
    kid: "The panel holds 100 little corner cubes.",
    deeper: "",
    value: "100 cubes",
    date: null,
    sourceTitle: "JPL: Earth-Moon System",
    sourceUrl: "https://www.jpl.nasa.gov/news/earth-moon-system",
    status: "checked",
    checkedOn: "2026-11-10",
    ...overrides,
  };
}

describe("findFactReferences", () => {
  it("finds bracket, brace and function references", () => {
    const text = 'A [F:moon-recede] b {F:light-roundtrip} c fact("opp-distance") d fact(\'ing-72\')';
    expect(findFactReferences(text).sort()).toEqual(["ing-72", "light-roundtrip", "moon-recede", "opp-distance"]);
  });

  it("returns each id once", () => {
    expect(findFactReferences("[F:moon-recede] [F:moon-recede]")).toEqual(["moon-recede"]);
  });
});

describe("checkFacts", () => {
  it("passes a sourced, checked fact that is used", () => {
    const report = checkFacts([fact()], [{ path: "src/content/moon.ts", text: "[F:a11-lrrr-cubes]" }]);
    expect(report.errors).toEqual([]);
    expect(report.used).toEqual(["a11-lrrr-cubes"]);
  });

  it("fails when text references a missing fact", () => {
    const report = checkFacts([fact()], [{ path: "src/content/moon.ts", text: "[F:not-a-fact]" }]);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("missing fact");
  });

  it("fails when a used fact is still marked verify", () => {
    const report = checkFacts([fact({ status: "verify" })], [{ path: "a.ts", text: "[F:a11-lrrr-cubes]" }]);
    expect(report.errors.some((error) => error.includes("still marked verify"))).toBe(true);
  });

  it("fails when a checked fact has no source", () => {
    const report = checkFacts([fact({ sourceUrl: "" })], []);
    expect(report.errors.some((error) => error.includes("no source"))).toBe(true);
  });

  it("allows an unsourced verify fact as long as nothing uses it", () => {
    const report = checkFacts([fact({ status: "verify", sourceUrl: "", sourceTitle: "" })], []);
    expect(report.errors).toEqual([]);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it("fails on duplicate ids and em dashes", () => {
    const report = checkFacts([fact(), fact({ kid: "Left behind — still shining." })], []);
    expect(report.errors.some((error) => error.includes("more than once"))).toBe(true);
    expect(report.errors.some((error) => error.includes("em dash"))).toBe(true);
  });
});

describe("src/data/facts.json", () => {
  const { facts } = JSON.parse(readFileSync(new URL("../../src/data/facts.json", import.meta.url), "utf8")) as {
    facts: Fact[];
  };

  it("is seeded and internally valid", () => {
    expect(facts.length).toBeGreaterThanOrEqual(48);
    expect(checkFacts(facts, []).errors).toEqual([]);
  });
});
