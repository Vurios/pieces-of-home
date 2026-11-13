import { Group, type Matrix4, Mesh, type Object3D, Quaternion, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";

/**
 * Remi's museum shelf (Phase 05: "the workshop changes after each chapter").
 * A shelf on the workshop's left wall with one keepsake and one instant photo
 * for each stamp: a corner mirror, a mesh wheel, a jar of blueberry stones,
 * a rotor blade, a little scoop and a golden record. Empty spots wait with a
 * blank paper label until their chapter is done.
 */
export interface MuseumItem {
  /** The stamp that brings it out. */
  stamp: string;
  object: Object3D;
}

export interface Museum {
  items: MuseumItem[];
}

interface Look {
  stamp: string;
  sky: string;
  ground: string;
  accent: string;
  /** Builds the keepsake, standing at the origin, about 0.12 tall. */
  keepsake: (g: Group, mat: (color: string) => Mesh["material"]) => void;
}

const piece = (g: Group, geometry: Mesh["geometry"], material: Mesh["material"], p: [number, number, number], s: number | [number, number, number], r: [number, number, number] = [0, 0, 0]): Mesh => {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...p);
  if (typeof s === "number") mesh.scale.setScalar(s);
  else mesh.scale.set(...s);
  mesh.rotation.set(...r);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
};

const LOOKS: Look[] = [
  {
    stamp: "chapter-1",
    sky: "#1E2444",
    ground: "#B9B4AA",
    accent: "#D2A445",
    keepsake: (g, mat) => {
      // A corner of three little mirrors on a wooden foot.
      piece(g, cylinder(10), mat("#6B3F2A"), [0, 0.01, 0], [0.05, 0.02, 0.05]);
      piece(g, cone(3), mat("#C9D6DC"), [0, 0.06, 0], [0.045, 0.07, 0.045], [Math.PI, 0.4, 0]);
      piece(g, sphere("low"), mat("#EEF4F6"), [0, 0.08, 0.012], 0.012);
    },
  },
  {
    stamp: "chapter-2",
    sky: "#1E2444",
    ground: "#A9A49A",
    accent: "#8C9296",
    keepsake: (g, mat) => {
      // A wire-mesh wheel with chevrons, standing on edge.
      piece(g, torus(0.28), mat("#8C9296"), [0, 0.06, 0], 0.055, [0, Math.PI / 2, 0]);
      piece(g, cylinder(12), mat("#4A4440"), [0, 0.06, 0], [0.018, 0.04, 0.018], [0, 0, Math.PI / 2]);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        piece(g, box(0.004), mat("#F4F2EC"), [0, 0.06 + Math.cos(a) * 0.058, Math.sin(a) * 0.058], [0.03, 0.006, 0.012], [a, 0, 0]);
      }
    },
  },
  {
    stamp: "chapter-3",
    sky: "#E2A06B",
    ground: "#B5643A",
    accent: "#4C5A7A",
    keepsake: (g, mat) => {
      // A little glass jar of round blue-grey stones, like Opportunity's blueberries.
      piece(g, cylinder(12), mat("#DCE6E8"), [0, 0.05, 0], [0.04, 0.1, 0.04]);
      for (let i = 0; i < 5; i += 1) piece(g, sphere("low"), mat("#55606E"), [Math.cos(i * 2.4) * 0.018, 0.02 + (i % 3) * 0.014, Math.sin(i * 2.4) * 0.018], 0.012);
      piece(g, cylinder(12), mat("#B8433A"), [0, 0.105, 0], [0.042, 0.012, 0.042]);
    },
  },
  {
    stamp: "chapter-4",
    sky: "#D9946A",
    ground: "#8E3F2A",
    accent: "#EDEAE2",
    keepsake: (g, mat) => {
      // One long rotor blade on a stand.
      piece(g, cylinder(10), mat("#6B3F2A"), [0, 0.01, 0], [0.04, 0.02, 0.04]);
      piece(g, cylinder(6), mat("#4A4644"), [0, 0.05, 0], [0.006, 0.07, 0.006]);
      piece(g, box(0.004), mat("#EDEAE2"), [0, 0.09, 0], [0.2, 0.006, 0.026], [0, 0.6, 0.05]);
    },
  },
  {
    stamp: "bonus-surveyor",
    sky: "#1E2444",
    ground: "#B2ADA4",
    accent: "#C9B48C",
    keepsake: (g, mat) => {
      // A little tan scoop with its teeth, like Surveyor's.
      piece(g, box(0.008), mat("#C9B48C"), [0, 0.03, 0], [0.06, 0.04, 0.08], [0.2, 0.5, 0]);
      piece(g, box(0.004), mat("#8E8B86"), [0, 0.055, -0.01], [0.064, 0.008, 0.06], [0.2, 0.5, 0]);
      piece(g, cylinder(6), mat("#8E8B86"), [-0.02, 0.07, -0.04], [0.006, 0.08, 0.006], [0.9, 0.5, 0]);
    },
  },
  {
    stamp: "finale",
    sky: "#0F1430",
    ground: "#3E5A3A",
    accent: "#E9B44C",
    keepsake: (g, mat) => {
      // A golden record leaning on a little easel.
      piece(g, cylinder(24), mat("#E9B44C"), [0, 0.065, 0.01], [0.06, 0.006, 0.06], [Math.PI / 2 - 0.25, 0, 0]);
      piece(g, cylinder(12), mat("#8E6A1F"), [0, 0.065, 0.014], [0.012, 0.008, 0.012], [Math.PI / 2 - 0.25, 0, 0]);
      piece(g, box(0.004), mat("#6B3F2A"), [0, 0.03, -0.03], [0.012, 0.07, 0.012], [-0.4, 0, 0]);
    },
  },
];

/**
 * Builds the shelf into `b` (in the workshop frame `m`: +X right, +Y up, +Z
 * toward the door) and returns one object per keepsake, hidden until its
 * stamp. `wallX` is the inside face of the left wall.
 */
export function buildMuseum(b: Batcher, toon: ToonLibrary, m: Matrix4, wallX: number): Museum {
  const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
  const shelfY = 1.3;
  const z0 = -1.32;
  const step = 0.23;
  const length = step * LOOKS.length + 0.12;
  const zMid = z0 + (step * (LOOKS.length - 1)) / 2;
  // The shelf, its two brackets, and a painted sign above: "Remi's museum".
  b.place(box(0.01), "#8A5A3A", v(wallX + 0.13, shelfY, zMid), [0, 0, 0], [0.24, 0.04, length], m);
  b.place(box(0.006), "#5E3B26", v(wallX + 0.25, shelfY - 0.005, zMid), [0, 0, 0], [0.012, 0.05, length], m);
  for (const k of [-1, 1]) b.place(box(0.01), "#5E3B26", v(wallX + 0.08, shelfY - 0.09, zMid + k * (length / 2 - 0.12)), [0, 0, 0.6], [0.03, 0.18, 0.03], m);
  // The sign hangs left of the jar shelf, so the two never touch.
  const signZ = z0 + 0.2;
  b.place(box(0.006), "#F4ECDD", v(wallX + 0.012, shelfY + 0.52, signZ), [0, 0, 0], [0.012, 0.09, 0.5], m);
  for (let i = 0; i < 3; i += 1) b.place(box(0.002), "#2B2622", v(wallX + 0.02, shelfY + 0.535 - i * 0.022, signZ - 0.02 * i), [0, 0, 0], [0.004, 0.008, 0.4 - i * 0.1], m);
  b.place(sphere("low"), "#C8553D", v(wallX + 0.02, shelfY + 0.57, signZ), [0, 0, 0], 0.016, m);

  const quaternion = new Quaternion().setFromRotationMatrix(m);
  const materials = new Map<string, Mesh["material"]>();
  const mat = (color: string): Mesh["material"] => {
    let found = materials.get(color);
    if (!found) {
      found = toon.toon({ color, objectSpace: true, paint: 0.08 });
      materials.set(color, found);
    }
    return found;
  };
  const items: MuseumItem[] = LOOKS.map((look, i) => {
    const z = z0 + i * step;
    // An empty spot shows a blank paper label on the shelf edge.
    b.place(box(0.003), "#F4ECDD", v(wallX + 0.252, shelfY - 0.005, z), [0, 0, 0], [0.004, 0.026, 0.07], m);
    // One holder per spot, in the workshop's frame: the keepsake on the shelf, turned a little
    // toward the room, and its instant photo pinned flat to the wall above it.
    const holder = new Group();
    holder.position.copy(new Vector3(wallX + 0.15, shelfY + 0.02, z).applyMatrix4(m));
    holder.quaternion.copy(quaternion);
    const keepsake = new Group();
    look.keepsake(keepsake, mat);
    keepsake.rotation.y = Math.PI / 2 - 0.3;
    holder.add(keepsake);
    const photo = new Group();
    piece(photo, box(0.004), mat("#FBF7EE"), [0, 0, 0], [0.006, 0.19, 0.16]);
    piece(photo, box(0.002), mat(look.sky), [0.004, 0.03, 0], [0.004, 0.1, 0.13]);
    piece(photo, box(0.002), mat(look.ground), [0.005, -0.03, 0], [0.004, 0.04, 0.13]);
    piece(photo, box(0.002), mat(look.accent), [0.007, -0.005, 0.02], [0.004, 0.035, 0.035]);
    piece(photo, sphere("low"), mat("#C8553D"), [0.012, 0.085, 0], 0.012);
    photo.position.set(wallX + 0.012 - (wallX + 0.15), 0.25 + (i % 2) * 0.03, 0);
    photo.rotation.x = (i % 2 ? 1 : -1) * 0.07;
    holder.add(photo);
    holder.visible = false;
    const g = holder;
    return { stamp: look.stamp, object: g };
  });
  return { items };
}
