import { DoubleSide, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector3 } from "three";
import type { ToonLibrary } from "../render/toon";
import { damp, projectOnTangent, surfaceMatrix } from "../world/sphere";
import { box } from "./parts";

/**
 * Small moving props: the paper arrow that points to the next letter, and the
 * envelope a player carries.
 */
function arrowShape(scale: number): Shape {
  // A hand-cut paper arrow. The slight unevenness is on purpose.
  const s = scale;
  const shape = new Shape();
  shape.moveTo(0, 0.5 * s);
  shape.lineTo(0.36 * s, 0.06 * s);
  shape.lineTo(0.13 * s, 0.08 * s);
  shape.lineTo(0.15 * s, -0.46 * s);
  shape.lineTo(-0.14 * s, -0.44 * s);
  shape.lineTo(-0.12 * s, 0.07 * s);
  shape.lineTo(-0.37 * s, 0.05 * s);
  shape.closePath();
  return shape;
}

export class PaperArrow {
  readonly root = new Group();
  private paper: Mesh;
  private time = 0;
  private visibility = 0;
  private readonly heading = new Vector3(0, 0, 1);
  private readonly scratch = new Vector3();

  constructor() {
    const ink = new Mesh(new ShapeGeometry(arrowShape(0.62)), new MeshBasicMaterial({ color: "#2B2622", side: DoubleSide, transparent: true }));
    this.paper = new Mesh(new ShapeGeometry(arrowShape(0.5)), new MeshBasicMaterial({ color: "#F4ECDD", side: DoubleSide, transparent: true }));
    // Lay the arrow flat with its tip on local +Z, the way surfaceMatrix aims
    // "forward". (Flat on -PI/2 alone puts the tip on -Z: it pointed back at you.)
    ink.rotation.set(-Math.PI / 2, 0, Math.PI);
    this.paper.rotation.set(-Math.PI / 2, 0, Math.PI);
    this.paper.position.set(0, 0.004, 0.01);
    ink.renderOrder = 5;
    this.paper.renderOrder = 6;
    this.root.add(ink, this.paper);
    this.root.name = "objective-arrow";
  }

  /**
   * @param target world point to aim at, or null to hide.
   */
  update(dt: number, feet: Vector3, up: Vector3, target: Vector3 | null, reducedMotion: boolean): void {
    this.time += dt;
    let wanted = 0;
    if (target) {
      projectOnTangent(this.scratch.copy(target).sub(feet), up, this.scratch);
      const distance = this.scratch.length();
      if (distance > 2.2) {
        wanted = 1;
        this.heading.lerp(this.scratch.divideScalar(distance), damp(8, dt)).normalize();
      }
    }
    this.visibility += (wanted - this.visibility) * damp(6, dt);
    this.root.visible = this.visibility > 0.02;
    if (!this.root.visible) return;

    const bob = reducedMotion ? 0 : Math.sin(this.time * 3.2) * 0.05;
    const reach = 1.05 + (reducedMotion ? 0 : Math.sin(this.time * 3.2) * 0.06);
    const position = this.scratch.copy(feet).addScaledVector(this.heading, reach).addScaledVector(up, 0.08 + bob);
    surfaceMatrix(position, up, this.heading, this.root.matrix);
    this.root.matrix.decompose(this.root.position, this.root.quaternion, this.root.scale);
    this.root.scale.setScalar(this.visibility);
    for (const child of this.root.children) {
      ((child as Mesh).material as MeshBasicMaterial).opacity = this.visibility;
    }
  }

  dispose(): void {
    for (const child of this.root.children) {
      const mesh = child as Mesh;
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
  }
}

/** A letter in an envelope, with a red wax seal. */
export function createEnvelope(toon: ToonLibrary): Group {
  const group = new Group();
  group.name = "envelope";
  const paper = new Mesh(box(0.01), toon.toon({ color: "#F4ECDD", objectSpace: true, paint: 0.06 }));
  paper.scale.set(0.3, 0.2, 0.018);
  const flap = new Mesh(box(0.004), toon.toon({ color: "#E6D9BF", objectSpace: true, paint: 0.06 }));
  flap.scale.set(0.2, 0.2, 0.004);
  flap.rotation.z = Math.PI / 4;
  flap.position.set(0, 0.04, 0.011);
  const clip = new Mesh(box(0.004), toon.toon({ color: "#F4ECDD", objectSpace: true, paint: 0.06 }));
  clip.scale.set(0.3, 0.1, 0.006);
  clip.position.set(0, -0.05, 0.012);
  const seal = new Mesh(box(0.02), toon.toon({ color: "#C0573E", objectSpace: true, paint: 0.05 }));
  seal.scale.set(0.05, 0.05, 0.015);
  seal.position.set(0, 0.0, 0.018);
  group.add(paper, flap, clip, seal);
  group.traverse((object) => {
    if (object instanceof Mesh) object.castShadow = true;
  });
  return group;
}
