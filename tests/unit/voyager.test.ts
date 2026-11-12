import { describe, expect, it } from "vitest";
import { LIGHT_DAY, hoursAndMinutes, voyagerOn } from "../../src/content/voyager";

describe("Voyager 1 today", () => {
  it("is one light-day out at NASA's milestone moment", () => {
    // NASA: Nov. 18, 2026, 10:16:07 UTC, one light-day (1440 minutes) from Earth.
    const v = voyagerOn(new Date(LIGHT_DAY));
    expect(v.inRange).toBe(true);
    expect(v.lightMinutes).toBeGreaterThan(1439);
    expect(v.lightMinutes).toBeLessThan(1441);
  });

  it("matches NASA's distance at the milestone within a tenth of a percent", () => {
    // NASA: 25,902,068,356 km on Nov. 18, 2026.
    const v = voyagerOn(new Date(LIGHT_DAY));
    expect(Math.abs(v.km - 25_902_068_356) / 25_902_068_356).toBeLessThan(0.001);
  });

  it("interpolates between days and holds the ends", () => {
    const a = voyagerOn(new Date("2027-03-01T00:00:00Z"));
    const b = voyagerOn(new Date("2027-03-02T00:00:00Z"));
    const mid = voyagerOn(new Date("2027-03-01T12:00:00Z"));
    expect(mid.lightMinutes).toBeCloseTo((a.lightMinutes + b.lightMinutes) / 2, 3);
    expect(voyagerOn(new Date("2020-01-01")).inRange).toBe(false);
    expect(voyagerOn(new Date("2040-01-01")).inRange).toBe(false);
    expect(voyagerOn(new Date("2040-01-01")).lightMinutes).toBeGreaterThan(1440);
  });

  it("sits in the evening sky of Ophiuchus and Hercules", () => {
    const v = voyagerOn(new Date("2026-11-18T00:00:00Z"));
    expect(v.ra).toBeGreaterThan(255);
    expect(v.ra).toBeLessThan(262);
    expect(v.dec).toBeGreaterThan(10);
    expect(v.dec).toBeLessThan(14);
  });

  it("says hours and minutes the way a kid would", () => {
    expect(hoursAndMinutes(1440)).toBe("24 hours");
    expect(hoursAndMinutes(1442.4)).toBe("24 hours and 2 minutes");
    expect(hoursAndMinutes(61)).toBe("1 hour and 1 minute");
  });
});
