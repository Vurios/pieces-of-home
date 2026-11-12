import { type PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { InputFrame } from "../core/input";
import { type ColliderGroup, pointInsideColliders } from "./colliders";
import type { PlayerController } from "./controller";
import { damp, parallelTransport, projectOnTangent } from "./sphere";
import type { Terrain } from "./terrain";

/** A camera setup that a place can ask for, such as the dollhouse view inside the workshop. */
export interface CameraHint {
  /** World-space direction the camera should look along, flattened to the ground. */
  forward: Vector3;
  pitch: number;
  distance: number;
}

const DEFAULT_PITCH = 0.5;
/** From almost level with the ground to nearly straight down. */
const MIN_PITCH = 0.05;
const MAX_PITCH = 1.42;
const DEFAULT_DISTANCE = 7.2;
/** The player's zoom: close up to a view of half the little world. */
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.4;
/** Wait this long after the player stops steering the camera before it drifts back behind them. */
const RECENTER_DELAY = 3.5;
/** A place's preferred view waits this long after the player turned the camera themselves. */
const HINT_RESPECT = 5;

/**
 * Third-person camera for a tiny planet. It keeps a calm horizon by using the
 * player's "up" as its own, carries its heading over the curve without
 * twisting, trails with a little lag, and drifts back behind the player only
 * when they walk away from it. It never swings around when the player turns to
 * walk toward the lens, which is what makes sphere cameras feel dizzy.
 */
export class FollowCamera {
  /** Unit tangent the camera looks along (flattened). Movement input is relative to this. */
  readonly forward = new Vector3(0, 0, 1);
  readonly right = new Vector3(1, 0, 0);
  pitch = DEFAULT_PITCH;

  private readonly up = new Vector3(0, 1, 0);
  private readonly focus = new Vector3();
  private readonly lead = new Vector3();
  private distance = DEFAULT_DISTANCE;
  /** The player's own zoom (mouse wheel, + and -, a pinch), eased toward its target. */
  private zoom = 1;
  private zoomTarget = 1;
  private sinceLook = 10;
  private started = false;
  private readonly scratch = new Vector3();
  private readonly target = new Vector3();
  private readonly probe = new Vector3();
  private readonly q = new Quaternion();

  constructor(readonly camera: PerspectiveCamera) {}

  /** Places the camera behind the player at once, with no easing. */
  snap(player: PlayerController): void {
    this.up.copy(player.up);
    this.forward.copy(player.forward);
    this.pitch = DEFAULT_PITCH;
    this.focus.copy(player.position).addScaledVector(player.up, 0.85);
    this.lead.set(0, 0, 0);
    this.sinceLook = 10;
    this.started = false;
  }

  update(
    dt: number,
    player: PlayerController,
    input: InputFrame,
    terrain: Terrain,
    colliders: ColliderGroup[],
    hint: CameraHint | null,
  ): void {
    // Carry our heading to the player's new "up" without twisting it.
    parallelTransport(this.forward, this.up, player.up);
    this.up.copy(player.up);
    projectOnTangent(this.forward, this.up, this.forward).normalize();

    // Player steering: orbit around "up", and tilt.
    if (input.lookX !== 0 || input.lookY !== 0) {
      this.q.setFromAxisAngle(this.up, -input.lookX);
      this.forward.applyQuaternion(this.q);
      this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch + input.lookY));
      this.sinceLook = 0;
    } else {
      this.sinceLook += dt;
    }

    if (input.zoom !== 0) this.zoomTarget = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomTarget * (1 + input.zoom)));
    this.zoom += (this.zoomTarget - this.zoom) * damp(9, dt);

    let wantedPitch = DEFAULT_PITCH;
    let wantedDistance = DEFAULT_DISTANCE * this.zoom;

    if (hint) {
      // A place has a view it prefers. Ease toward it, unless the player has just chosen their own.
      const free = this.sinceLook > HINT_RESPECT;
      projectOnTangent(hint.forward, this.up, this.scratch);
      if (free && this.scratch.lengthSq() > 1e-6) {
        this.turnToward(this.scratch.normalize(), damp(2.0, dt));
      }
      wantedPitch = hint.pitch;
      wantedDistance = hint.distance * this.zoom;
      if (free) this.pitch += (wantedPitch - this.pitch) * damp(2.0, dt);
    } else if (this.sinceLook > RECENTER_DELAY && player.pace > 0.3) {
      // Drift back behind the player, gently, and only when they walk mostly away from us.
      const facing = this.forward.dot(player.forward);
      if (facing > -0.2) this.turnToward(player.forward, damp(0.45 + facing * 0.35, dt));
    }

    // Tall screens need the camera farther back to show the same ground.
    const aspect = this.camera.aspect;
    if (aspect < 1) wantedDistance *= 1 + (1 - aspect) * 0.55;

    // Look a little ahead of where the player is going.
    this.lead.lerp(this.scratch.copy(player.velocity).multiplyScalar(0.28), damp(2.2, dt));
    this.target.copy(player.position).addScaledVector(this.up, 0.85).add(this.lead);
    if (!this.started) {
      this.focus.copy(this.target);
      this.started = true;
    } else {
      // Follow closely across the ground, but let a jump rise in front of the lens
      // instead of bouncing the whole view with it.
      this.scratch.copy(this.target).sub(this.focus);
      const rise = this.scratch.dot(this.up);
      this.scratch.addScaledVector(this.up, -rise);
      this.focus.addScaledVector(this.scratch, damp(9, dt)).addScaledVector(this.up, rise * damp(player.grounded ? 8 : 2.4, dt));
    }

    // A touch more lens when running, for a sense of speed.
    const base = (this.camera.userData["baseFov"] as number | undefined) ?? this.camera.fov;
    const fov = base + (player.running && player.pace > 1.2 ? 3.5 : 0);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * damp(3, dt);
      this.camera.updateProjectionMatrix();
    }

    // Pull in if a prop or a hill is in the way. Come in fast, ease back out slowly.
    let allowed = wantedDistance;
    for (let i = 0; i < 10; i += 1) {
      this.place(allowed, this.probe);
      const ground = terrain.radiusAt(this.scratch.copy(this.probe).normalize()) + 0.45;
      const blocked = this.probe.length() < ground || pointInsideColliders(colliders, this.probe, 0.3);
      if (!blocked) break;
      allowed *= 0.86;
    }
    this.distance += (allowed - this.distance) * damp(allowed < this.distance ? 14 : 2.5, dt);

    this.place(this.distance, this.camera.position);
    // Never let the lens dip under the ground.
    const floor = terrain.radiusAt(this.scratch.copy(this.camera.position).normalize()) + 0.35;
    if (this.camera.position.length() < floor) this.camera.position.setLength(floor);

    this.camera.up.copy(this.up);
    this.camera.lookAt(this.focus);
    this.right.crossVectors(this.forward, this.up).normalize();
  }

  private place(distance: number, out: Vector3): Vector3 {
    return out
      .copy(this.focus)
      .addScaledVector(this.forward, -Math.cos(this.pitch) * distance)
      .addScaledVector(this.up, Math.sin(this.pitch) * distance);
  }

  /** Rotates `forward` part of the way toward `wanted` around "up". */
  private turnToward(wanted: Vector3, amount: number): void {
    const cos = Math.max(-1, Math.min(1, this.forward.dot(wanted)));
    const angle = Math.acos(cos);
    if (angle < 1e-4) return;
    const side = this.scratch.crossVectors(this.forward, wanted).dot(this.up) >= 0 ? 1 : -1;
    this.q.setFromAxisAngle(this.up, side * angle * Math.min(1, amount));
    this.forward.applyQuaternion(this.q);
    projectOnTangent(this.forward, this.up, this.forward).normalize();
  }
}
