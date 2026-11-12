import { BoxGeometry, Material, Mesh, SphereGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { Batcher, behindPlanet, planetMeshes } from "../../src/game/render/kit";

describe("horizon culling", () => {
  const eye = new Vector3(0, 30, 0);
  const R = 20;

  it("keeps what faces the camera", () => {
    expect(behindPlanet(eye, R, new Vector3(0, 20, 0), 2)).toBe(false);
    expect(behindPlanet(eye, R, new Vector3(14, 14, 0), 2)).toBe(false);
  });

  it("hides what is round the back of the planet", () => {
    expect(behindPlanet(eye, R, new Vector3(0, -20, 0), 2)).toBe(true);
    expect(behindPlanet(eye, R, new Vector3(14, -14, 0), 2)).toBe(true);
  });

  it("keeps things standing just past the horizon whose tops still show", () => {
    // The horizon from 30 units out on a 20 unit planet is at about 48 degrees from the eye's line.
    const tall = new Vector3(Math.sin(1.05), Math.cos(1.05), 0).multiplyScalar(R + 6);
    expect(behindPlanet(eye, R, tall, 6)).toBe(false);
  });

  it("never hides anything when the eye is inside the planet", () => {
    expect(behindPlanet(new Vector3(0, 5, 0), R, new Vector3(0, -20, 0), 1)).toBe(false);
  });

  it("cuts a planet into wedges that keep every triangle", () => {
    const sphere = new SphereGeometry(20, 48, 32);
    const triangles = sphere.index!.count / 3;
    const wedges = planetMeshes(sphere, new Material(), 16);
    expect(wedges.length).toBeGreaterThan(8);
    expect(wedges.reduce((n, m) => n + m.geometry.index!.count / 3, 0)).toBe(triangles);
    for (const m of wedges) expect(m.userData["horizon"]).toBe(true);
  });

  it("sorts a world's pieces into wedges, and keeps the middle in one group", () => {
    const b = new Batcher();
    const box = new BoxGeometry(1, 1, 1);
    for (let i = 0; i < 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      b.place(box, "#fff", [Math.cos(a) * 20, Math.sin(a) * 20, 0]);
    }
    b.place(box, "#fff", [0, 0, 0]);
    const meshes = b.build({ solid: new Material() }, { sectors: 16 });
    expect(meshes.length).toBeGreaterThan(4);
    expect(meshes.filter((m: Mesh) => !m.userData["horizon"]).length).toBe(1);
    expect(meshes.reduce((n, m) => n + m.geometry.index!.count, 0)).toBe(41 * 36);
  });
});
