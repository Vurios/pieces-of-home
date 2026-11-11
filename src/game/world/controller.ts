import { Vector3 } from "three";
import type { GameBus } from "../core/events";
import type { InputFrame } from "../core/input";
import { type ColliderGroup, resolveColliders } from "./colliders";
import { damp, parallelTransport, projectOnTangent } from "./sphere";
import type { Terrain } from "./terrain";

export const WALK_SPEED = 3.1;
export const RUN_SPEED = 5.4;
const JUMP_SPEED = 6.4;
const GRAVITY = 19;
const BODY_RADIUS = 0.3;
const STEP_HEIGHT = 0.38;
const STEP_LENGTH = 0.85;

export interface Ground {
  terrain: Terrain;
  colliders: ColliderGroup[];
  /** Names the surface under a point, for footstep sounds and dust. */
  surfaceAt?: (dir: Vector3, onPlatform: boolean) => string;
}

/**
 * Walks a character around a small planet. "Up" always points away from the
 * planet center, movement happens in the tangent plane, and the facing
 * direction is carried along the curve so it never twists.
 */
export class PlayerController {
  /** Feet position in world space. */
  readonly position = new Vector3();
  readonly up = new Vector3(0, 1, 0);
  /** Unit tangent the character faces. */
  readonly forward = new Vector3(0, 0, 1);
  /** Tangent velocity in world units per second. */
  readonly velocity = new Vector3();
  verticalSpeed = 0;
  grounded = true;
  /** 0 standing, 1 walking, about 1.75 running. Drives the animation. */
  pace = 0;
  running = false;
  /** Seconds since the last landing. Drives the squash on landing. */
  sinceLanding = 10;
  landingSpeed = 0;
  /** While above 0 the character ignores movement input (for example mid-interaction). */
  frozen = 0;

  private stepDistance = 0;
  /** A jump still works for a moment after walking off an edge... */
  private coyote = 0;
  /** ...and a press just before landing is kept until the feet touch down. */
  private jumpBuffer = 0;
  private readonly desired = new Vector3();
  private readonly oldUp = new Vector3();
  private readonly platform = new Vector3();
  private readonly scratch = new Vector3();

  constructor(private bus: GameBus) {}

  teleport(dir: Vector3, forward: Vector3, ground: Ground): void {
    this.up.copy(dir).normalize();
    this.position.copy(this.up).multiplyScalar(ground.terrain.radiusAt(this.up));
    projectOnTangent(forward, this.up, this.forward).normalize();
    this.velocity.set(0, 0, 0);
    this.verticalSpeed = 0;
    this.grounded = true;
    this.pace = 0;
  }

  /**
   * @param cameraForward unit tangent pointing away from the camera
   * @param cameraRight   unit tangent pointing to the camera's right
   */
  update(dt: number, input: InputFrame, cameraForward: Vector3, cameraRight: Vector3, ground: Ground): void {
    this.sinceLanding += dt;
    this.frozen = Math.max(0, this.frozen - dt);
    const active = this.frozen <= 0;

    // 1. Where the player wants to go, in the tangent plane.
    const amount = active ? Math.min(1, Math.hypot(input.moveX, input.moveY)) : 0;
    this.desired.set(0, 0, 0);
    if (amount > 0.01) {
      this.desired.addScaledVector(cameraRight, input.moveX).addScaledVector(cameraForward, input.moveY);
      projectOnTangent(this.desired, this.up, this.desired);
      if (this.desired.lengthSq() > 1e-8) this.desired.normalize();
    }
    this.running = active && input.run && amount > 0.5;
    const topSpeed = (this.running ? RUN_SPEED : WALK_SPEED) * amount;
    this.desired.multiplyScalar(topSpeed);

    // Quicker to start and stop on the ground than in the air.
    this.velocity.lerp(this.desired, damp(this.grounded ? 11 : 3.5, dt));
    const speed = this.velocity.length();
    this.pace = speed / WALK_SPEED;

    // 2. Turn to face the way we move.
    if (speed > 0.25) {
      this.scratch.copy(this.velocity).divideScalar(speed);
      this.forward.lerp(this.scratch, damp(12, dt));
      projectOnTangent(this.forward, this.up, this.forward);
      if (this.forward.lengthSq() < 1e-6) this.forward.copy(this.scratch);
      this.forward.normalize();
    }

    // 3. Jump, forgiving by a fraction of a second either side, so it never feels like a missed press.
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = active && input.jumpPressed ? 0.14 : Math.max(0, this.jumpBuffer - dt);
    if (active && this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.verticalSpeed = JUMP_SPEED;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.bus.emit("player:jump", {});
    }

    // 4. Slide along the tangent plane, then bend back onto the sphere.
    let height = this.position.length();
    this.oldUp.copy(this.up);
    this.position.addScaledVector(this.velocity, dt);
    this.position.normalize().multiplyScalar(height);

    // 5. Walls push out sideways. Platforms report their tops.
    const hit = resolveColliders(ground.colliders, this.position, BODY_RADIUS, STEP_HEIGHT, this.platform);
    this.up.copy(this.position).normalize();
    parallelTransport(this.velocity, this.oldUp, this.up);
    parallelTransport(this.forward, this.oldUp, this.up);
    projectOnTangent(this.forward, this.up, this.forward).normalize();
    if (hit.pushed) projectOnTangent(this.velocity, this.up, this.velocity);

    // 6. Gravity and the ground.
    const terrainHeight = ground.terrain.radiusAt(this.up);
    const platformHeight = hit.platform ? hit.platform.length() : -Infinity;
    const floor = Math.max(terrainHeight, platformHeight);
    height = this.position.length();

    if (this.grounded) {
      if (floor < height - STEP_HEIGHT) {
        // Walked off a ledge.
        this.grounded = false;
        this.verticalSpeed = 0;
      } else {
        // Follow the ground. Ease up steps so they feel soft.
        height = floor > height ? height + (floor - height) * damp(22, dt) : floor;
      }
    }
    if (!this.grounded) {
      this.verticalSpeed -= GRAVITY * dt;
      height += this.verticalSpeed * dt;
      if (height <= floor && this.verticalSpeed <= 0) {
        height = floor;
        this.grounded = true;
        this.landingSpeed = -this.verticalSpeed;
        this.sinceLanding = 0;
        this.verticalSpeed = 0;
        this.bus.emit("player:land", { speed: this.landingSpeed });
      }
    }
    this.position.copy(this.up).multiplyScalar(height);

    // 7. Footsteps.
    if (this.grounded && speed > 0.4) {
      this.stepDistance += speed * dt;
      const stride = this.running ? STEP_LENGTH * 1.25 : STEP_LENGTH;
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        const surface = ground.surfaceAt?.(this.up, platformHeight > terrainHeight) ?? "ground";
        this.bus.emit("player:step", { surface, running: this.running });
      }
    } else if (speed <= 0.4) {
      this.stepDistance = STEP_LENGTH * 0.5;
    }
  }
}
