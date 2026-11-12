import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { globeView, localView, onGlobe, onGround, spinGlobe } from "../../src/ui/map/projection";
import { headingToTangent, latLonToDir } from "../../src/game/world/sphere";

describe("Dad's map: the globe", () => {
  const center = latLonToDir(0, 0);
  const view = globeView(center, new Vector3(0, 1, 0));

  it("puts the center in the middle, near side up", () => {
    const p = onGlobe(view, center);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(1);
  });

  it("puts north up and east to the right, as seen from outside", () => {
    const north = onGlobe(view, latLonToDir(30, 0));
    expect(north.y).toBeGreaterThan(0.4);
    expect(Math.abs(north.x)).toBeLessThan(1e-6);
    const east = onGlobe(view, latLonToDir(0, 30));
    expect(east.x).toBeGreaterThan(0.4);
    expect(Math.abs(east.y)).toBeLessThan(1e-6);
  });

  it("hides the far side", () => {
    expect(onGlobe(view, latLonToDir(0, 180)).z).toBeLessThan(0);
  });

  it("spins the way it is dragged", () => {
    const right = spinGlobe(view, 0.3, 0);
    expect(onGlobe(right, center).x).toBeGreaterThan(0.2);
    const up = spinGlobe(view, 0, 0.3);
    expect(onGlobe(up, center).y).toBeGreaterThan(0.2);
    // Still a proper frame after spinning.
    expect(right.center.dot(right.north)).toBeCloseTo(0);
    expect(up.east.dot(up.north)).toBeCloseTo(0);
  });

  it("copes with looking straight down a pole", () => {
    const pole = globeView(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    expect(pole.north.length()).toBeCloseTo(1);
    expect(pole.east.dot(pole.north)).toBeCloseTo(0);
  });
});

describe("Dad's map: the corner map", () => {
  const radius = 14;
  const up = latLonToDir(10, 20);

  it("counts true meters along the ground, ahead is up the page", () => {
    const facing = headingToTangent(up, 0);
    const view = localView(up, facing, radius);
    // Five meters due north is five meters straight ahead.
    const ahead = up.clone().multiplyScalar(Math.cos(5 / radius)).addScaledVector(facing, Math.sin(5 / radius));
    const p = onGround(view, ahead);
    expect(p.y).toBeCloseTo(5, 5);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.distance).toBeCloseTo(5, 5);
  });

  it("puts east on the right when facing north", () => {
    const view = localView(up, headingToTangent(up, 0), radius);
    const east = headingToTangent(up, 90);
    const p = onGround(view, up.clone().multiplyScalar(Math.cos(3 / radius)).addScaledVector(east, Math.sin(3 / radius)));
    expect(p.x).toBeCloseTo(3, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });

  it("turns with the camera: facing east, north is on the left", () => {
    const view = localView(up, headingToTangent(up, 90), radius);
    const north = headingToTangent(up, 0);
    const p = onGround(view, up.clone().multiplyScalar(Math.cos(3 / radius)).addScaledVector(north, Math.sin(3 / radius)));
    expect(p.x).toBeCloseTo(-3, 5);
  });
});
