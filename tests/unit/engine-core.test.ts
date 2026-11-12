import { Color, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { EventBus, type GameEvents } from "../../src/game/core/events";
import { DEFAULT_BINDINGS, type InputFrame, reviveBindings } from "../../src/game/core/input";
import { FrameWatchdog, ResolutionGovernor, detectTier, lowerTier } from "../../src/game/core/quality";
import { StateStore, createInitialState, reviveState } from "../../src/game/core/state";
import { gradeColor } from "../../src/game/render/grade";
import { createColliderGroup, pointInsideColliders, resolveColliders } from "../../src/game/world/colliders";
import { InteractionSystem } from "../../src/game/world/interaction";
import { dirToLatLon, headingToTangent, latLonToDir, parallelTransport, surfaceMatrix } from "../../src/game/world/sphere";
import { Terrain } from "../../src/game/world/terrain";
import { globeDir } from "../../src/game/worlds/home/workshop";

const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps;

describe("sphere math", () => {
  it("round-trips latitude and longitude", () => {
    for (const [lat, lon] of [[0, 0], [45, 90], [-30, -120], [10, 179]] as const) {
      const back = dirToLatLon(latLonToDir(lat, lon));
      expect(near(back.lat, lat, 1e-9)).toBe(true);
      expect(near(back.lon, lon, 1e-9)).toBe(true);
    }
  });

  it("gives tangents that lie flat on the surface", () => {
    const up = latLonToDir(20, 40);
    for (const heading of [0, 90, 180, 270]) {
      const t = headingToTangent(up, heading);
      expect(near(t.dot(up), 0)).toBe(true);
      expect(near(t.length(), 1)).toBe(true);
    }
    // North points toward the north pole.
    expect(headingToTangent(latLonToDir(0, 0), 0).y).toBeGreaterThan(0.99);
  });

  it("carries a heading over the curve without twisting it off the surface", () => {
    const a = latLonToDir(0, 0);
    const b = latLonToDir(5, 3);
    const v = headingToTangent(a, 30);
    parallelTransport(v, a, b);
    expect(near(v.dot(b), 0, 1e-9)).toBe(true);
    expect(near(v.length(), 1, 1e-9)).toBe(true);
  });

  it("builds an upright surface frame", () => {
    const up = latLonToDir(-10, 60);
    const m = surfaceMatrix(up.clone().multiplyScalar(15), up, headingToTangent(up, 45));
    const y = new Vector3().setFromMatrixColumn(m, 1);
    expect(y.distanceTo(up)).toBeLessThan(1e-9);
  });
});

describe("terrain", () => {
  const pad = latLonToDir(10, 10);
  const terrain = new Terrain({ radius: 15, seed: 3, noiseAmplitude: 0.3, noiseFrequency: 2, pads: [{ center: pad, radius: 3, blend: 1 }] });

  it("stays near the base radius", () => {
    for (let i = 0; i < 50; i += 1) {
      const r = terrain.radiusAt(latLonToDir(i * 7 - 80, i * 23));
      expect(r).toBeGreaterThan(14.4);
      expect(r).toBeLessThan(15.6);
    }
  });

  it("makes building pads truly flat", () => {
    const m = surfaceMatrix(pad.clone().multiplyScalar(15), pad, headingToTangent(pad, 0));
    const inverse = m.clone().invert();
    for (const [x, z] of [[0, 0], [1.5, 0.5], [-2, 1], [0.3, -2.5]] as const) {
      const dir = new Vector3(x, 0, z).applyMatrix4(m).normalize();
      const local = terrain.pointAt(dir).applyMatrix4(inverse);
      expect(Math.abs(local.y)).toBeLessThan(1e-6);
    }
  });
});

describe("colliders", () => {
  const frame = new Matrix4();
  const group = createColliderGroup(frame, [
    { kind: "circle", x: 0, z: 0, radius: 1, height: 3 },
    { kind: "box", x: 5, z: 0, halfWidth: 1, halfDepth: 1, height: 0.3 },
  ]);
  const platform = new Vector3();

  it("pushes the player out of a wall", () => {
    const p = new Vector3(0.5, 0, 0);
    const hit = resolveColliders([group], p, 0.3, 0.38, platform);
    expect(hit.pushed).toBe(true);
    expect(p.x).toBeCloseTo(1.3, 5);
  });

  it("lets the player step onto a low platform", () => {
    const p = new Vector3(5, 0, 0);
    const hit = resolveColliders([group], p, 0.3, 0.38, platform);
    expect(hit.pushed).toBe(false);
    expect(hit.platform?.y).toBeCloseTo(0.3, 5);
  });

  it("knows when a point is inside a prop", () => {
    expect(pointInsideColliders([group], new Vector3(0, 1, 0))).toBe(true);
    expect(pointInsideColliders([group], new Vector3(0, 5, 0))).toBe(false);
  });
});

describe("state", () => {
  it("revives a good save and rejects junk", () => {
    const good = { ...createInitialState(), miloStage: 3, delivered: ["a", "a", "b"] };
    const revived = reviveState(JSON.parse(JSON.stringify(good)));
    expect(revived.miloStage).toBe(3);
    expect(revived.delivered).toEqual(["a", "b"]);
    expect(reviveState({ version: 999 })).toEqual(createInitialState());
    expect(reviveState("nope")).toEqual(createInitialState());
    expect(reviveState({ ...good, miloStage: 42 }).miloStage).toBe(5);
  });

  it("notifies listeners and serializes", () => {
    const store = new StateStore();
    let seen = 0;
    store.subscribe(() => (seen += 1));
    store.update((s) => s.delivered.push("to-the-lamp"));
    expect(seen).toBe(1);
    const copy = new StateStore();
    copy.load(store.serialize());
    expect(copy.value.delivered).toEqual(["to-the-lamp"]);
  });
});

describe("quality tiers", () => {
  it("picks low for software rendering and tiny devices", () => {
    expect(detectTier({ memory: 8, cores: 8, mobile: false, gpu: "angle (google, swiftshader device)", minSide: 900 })).toBe("low");
    expect(detectTier({ memory: 2, cores: 8, mobile: true, gpu: "adreno (tm) 640", minSide: 390 })).toBe("low");
  });

  it("picks high for a strong laptop and medium for an unknown one", () => {
    expect(detectTier({ memory: 16, cores: 12, mobile: false, gpu: "angle (nvidia, nvidia geforce rtx 4050)", minSide: 900 })).toBe("high");
    expect(detectTier({ memory: undefined, cores: 4, mobile: false, gpu: "", minSide: 900 })).toBe("medium");
  });

  it("drops one tier after a few slow seconds, never below low", () => {
    const watchdog = new FrameWatchdog();
    let dropped = false;
    for (let i = 0; i < 60 * 5 && !dropped; i += 1) dropped = watchdog.update(1 / 20);
    expect(dropped).toBe(true);
    expect(lowerTier("high")).toBe("medium");
    expect(lowerTier("low")).toBe("low");
  });
});

describe("key bindings", () => {
  it("keeps defaults for bad data and accepts good overrides", () => {
    expect(reviveBindings(null)).toEqual(DEFAULT_BINDINGS);
    const custom = reviveBindings({ jump: ["KeyJ"], left: "nope", run: [] });
    expect(custom.jump).toEqual(["KeyJ"]);
    expect(custom.left).toEqual(DEFAULT_BINDINGS.left);
    expect(custom.run).toEqual(DEFAULT_BINDINGS.run);
  });
});

describe("interaction", () => {
  const frame = (over: Partial<InputFrame> = {}): InputFrame => ({
    moveX: 0, moveY: 0, run: false, jumpPressed: false, interactPressed: false, interactHeld: false, lookX: 0, lookY: 0, zoom: 0, ...over,
  });

  it("fires a press prompt only in reach, and a hold prompt after holding", () => {
    const bus = new EventBus<GameEvents>();
    const system = new InteractionSystem(bus);
    let pressed = 0;
    let held = 0;
    system.add({ id: "box", position: new Vector3(1, 0, 0), radius: 1.5, kind: "press", label: () => "Open", onDone: () => (pressed += 1) });
    system.add({ id: "dish", position: new Vector3(10, 0, 0), radius: 1.5, kind: "hold", holdTime: 1, label: () => "Point", onDone: () => (held += 1) });
    const forward = new Vector3(1, 0, 0);

    system.update(0.016, new Vector3(5, 0, 0), forward, frame({ interactPressed: true }));
    expect(pressed).toBe(0);
    system.update(0.016, new Vector3(0, 0, 0), forward, frame({ interactPressed: true }));
    expect(pressed).toBe(1);

    const at = new Vector3(9.5, 0, 0);
    for (let i = 0; i < 30; i += 1) system.update(0.016, at, forward, frame({ interactHeld: true }));
    expect(held).toBe(0);
    for (let i = 0; i < 40; i += 1) system.update(0.016, at, forward, frame({ interactHeld: true }));
    expect(held).toBe(1);
  });
});

describe("globe pins", () => {
  it("puts longitude 0 at the texture center and east longitudes to the right", () => {
    // SphereGeometry maps u = 0.5 to +X, u = 0.75 to -Z.
    expect(globeDir(0, 0).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-9);
    expect(globeDir(0, 90).distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-9);
    expect(globeDir(90, 0).y).toBeCloseTo(1, 9);
  });
});

describe("color grade", () => {
  it("is close to identity with neutral settings, and lifts black", () => {
    const neutral = { shadows: "#808080", highlights: "#808080", shadowAmount: 0, highlightAmount: 0, saturation: 1, contrast: 1, lift: 0 };
    const grey = new Color(0.5, 0.5, 0.5);
    const [r, g, b] = gradeColor(0.3, 0.6, 0.9, neutral, grey, grey);
    expect(r).toBeCloseTo(0.3, 5);
    expect(g).toBeCloseTo(0.6, 5);
    expect(b).toBeCloseTo(0.9, 5);
    const lifted = gradeColor(0, 0, 0, { ...neutral, lift: 0.06 }, grey, grey);
    expect(lifted[0]).toBeCloseTo(0.06, 5);
  });
});

describe("resolution governor", () => {
  it("draws fewer pixels when slow and wins them back when there is room", () => {
    const governor = new ResolutionGovernor();
    const run = (fps: number, seconds: number): void => {
      for (let i = 0; i < fps * seconds; i += 1) governor.update(1 / fps);
    };
    // One slow second is forgiven (a shader warming up); two in a row are not.
    run(30, 1.05);
    expect(governor.scale).toBe(1);
    run(30, 1.05);
    expect(governor.scale).toBeCloseTo(0.9);
    run(30, 20);
    expect(governor.scale).toBeCloseTo(0.6);
    run(60, 30);
    expect(governor.scale).toBeGreaterThan(0.6);
    run(60, 200);
    expect(governor.scale).toBe(1);
  });

  it("never changes twice within a few seconds, so the picture does not seesaw", () => {
    const governor = new ResolutionGovernor();
    let changes = 0;
    for (let s = 0; s < 20; s += 1) {
      const fps = s % 2 ? 30 : 60;
      for (let i = 0; i < fps; i += 1) if (governor.update(1 / fps) !== null) changes += 1;
    }
    expect(changes).toBeLessThanOrEqual(2);
  });
});
