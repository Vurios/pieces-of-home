import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { angleOff, cornerAxes, cornerMirrors, reflect, trace } from "../../src/game/puzzles/optics";

const deg = (r: number): number => (r * 180) / Math.PI;

describe("optics", () => {
  it("reflects across a normal", () => {
    const r = reflect(new Vector3(1, -1, 0).normalize(), new Vector3(0, 1, 0));
    expect(r.x).toBeCloseTo(Math.SQRT1_2);
    expect(r.y).toBeCloseTo(Math.SQRT1_2);
  });

  it("makes three edges at right angles round a diagonal", () => {
    const [a, b, c] = cornerAxes(new Vector3(0.3, 1, 0.2), new Vector3(0, 1, 0), 0.7);
    expect(a.dot(b)).toBeCloseTo(0);
    expect(b.dot(c)).toBeCloseTo(0);
    expect(a.dot(c)).toBeCloseTo(0);
    const diag = a.clone().add(b).add(c).normalize();
    expect(angleOff(diag, new Vector3(0.3, 1, 0.2))).toBeLessThan(1e-6);
  });

  it("sends light straight back from a full corner, from many angles", () => {
    const axis = new Vector3(0, 1, 0.6).normalize();
    const axes = cornerAxes(axis, new Vector3(0, 1, 0));
    const corner = new Vector3(0, 0, 0);
    const mirrors = cornerMirrors(corner, axes, 1);
    // A target inside the corner, a little off its diagonal so the ray never meets the very tip.
    const target = axis.clone().multiplyScalar(0.3).addScaledVector(axes[0], 0.06).addScaledVector(axes[1], -0.025);
    for (const [yaw, pitch] of [[0, 0], [0.3, 0.1], [-0.4, -0.2], [0.5, 0.15], [-0.2, 0.3]] as const) {
      const toward = axis.clone().applyAxisAngle(new Vector3(0, 1, 0), yaw).applyAxisAngle(new Vector3(1, 0, 0), pitch).normalize();
      const start = target.clone().addScaledVector(toward, 50);
      const result = trace(start, toward.clone().negate(), mirrors);
      expect(result.bounces).toBe(3);
      expect(deg(angleOff(result.out, toward))).toBeLessThan(1e-6);
    }
  });

  it("misses with one or two mirrors", () => {
    const axis = new Vector3(0, 1, 0.6).normalize();
    const axes = cornerAxes(axis, new Vector3(0, 1, 0));
    const target = axis.clone().multiplyScalar(0.3);
    const toward = axis.clone().applyAxisAngle(new Vector3(0, 1, 0), 0.2).normalize();
    for (const count of [1, 2]) {
      const mirrors = cornerMirrors(new Vector3(), axes, 1, count);
      const result = trace(target.clone().addScaledVector(toward, 50), toward.clone().negate(), mirrors);
      expect(deg(angleOff(result.out, toward))).toBeGreaterThan(10);
    }
  });

  it("stops light at the back of a panel", () => {
    const mirror = { center: new Vector3(), normal: new Vector3(0, 1, 0), u: new Vector3(1, 0, 0), v: new Vector3(0, 0, 1), half: 1 };
    const result = trace(new Vector3(0, -5, 0), new Vector3(0, 1, 0), [mirror]);
    expect(result.bounces).toBe(0);
    expect(result.points).toHaveLength(2);
  });
});

describe("Dad's practice corner", async () => {
  const { AIM, CORNER_SIZE, TWIST, YAWS } = await import("../../src/game/puzzles/send-a-light");
  // The same setup as the game: Earth low in the sky, the corner aimed at it.
  const elevation = (12 * Math.PI) / 180;
  const earth = new Vector3(0, Math.sin(elevation), Math.cos(elevation));
  const up = new Vector3(0, 1, 0);
  const run = (yaw: number, count: number) => {
    const axes = cornerAxes(earth, up, TWIST).map((a) => a.applyAxisAngle(up, (yaw * Math.PI) / 180)) as [Vector3, Vector3, Vector3];
    const corner = new Vector3(0, 0.6, 0);
    const aim = corner.clone().addScaledVector(axes[0], AIM[0] * CORNER_SIZE).addScaledVector(axes[1], AIM[1] * CORNER_SIZE).addScaledVector(axes[2], AIM[2] * CORNER_SIZE);
    return trace(aim.clone().addScaledVector(earth, 90), earth.clone().negate(), cornerMirrors(corner, axes, CORNER_SIZE, count));
  };

  it("sends the light home from every turn once all three mirrors are in", () => {
    for (const yaw of YAWS) expect(deg(angleOff(run(yaw, 3).out, earth))).toBeLessThan(0.01);
  });

  it("misses Earth with one or two mirrors", () => {
    expect(run(0, 1).bounces).toBe(1);
    expect(deg(angleOff(run(0, 1).out, earth))).toBeGreaterThan(30);
    expect(run(0, 2).bounces).toBe(2);
    expect(deg(angleOff(run(0, 2).out, earth))).toBeGreaterThan(30);
  });
});
