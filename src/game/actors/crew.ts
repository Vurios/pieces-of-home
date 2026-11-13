import { Group, Vector3 } from "three";
import type { ToonLibrary } from "../render/toon";
import { Character, type KidId } from "./character";
import { createEnvelope } from "./props";

/**
 * The friends in a co-op room, drawn in this player's world (Phase 06).
 *
 * Each friend's client sends where they stand only while they move, about
 * eight times a second. Here every friend keeps a short list of those
 * samples and is drawn a little in the past (DELAY), sliding between the two
 * samples around that moment, so they glide instead of hopping.
 */

/** Draw friends this far behind the newest sample: enough to always have two to slide between. */
const DELAY_MS = 160;
/** Too far behind to catch up smoothly (a hitch, or a teleport): jump. */
const SNAP_DISTANCE = 4;

interface Sample {
  at: number;
  position: Vector3;
  forward: Vector3;
  pace: number;
  carrying: boolean;
  seated: boolean;
}

export interface Friend {
  seat: number;
  kid: KidId;
  character: Character;
  world: string | null;
  samples: Sample[];
  /** Where the friend is drawn now. */
  position: Vector3;
  forward: Vector3;
  envelope: Group;
  /** Seconds since the friend was last drawn walking in; for the soft light when they appear. */
  shown: number;
}

export class Crew {
  readonly root = new Group();
  private friends = new Map<number, Friend>();
  private readonly up = new Vector3();
  private readonly side = new Vector3();
  private suits = false;

  constructor(private readonly toon: ToonLibrary) {
    this.root.name = "crew";
  }

  get list(): Friend[] {
    return [...this.friends.values()];
  }

  /** Adds a friend, or changes which kid they play. */
  set(seat: number, kid: KidId): void {
    const found = this.friends.get(seat);
    if (found && found.kid === kid) return;
    if (found) this.remove(seat);
    const character = new Character(kid, this.toon);
    character.setSuit(this.suits);
    character.root.visible = false;
    const envelope = createEnvelope(this.toon);
    envelope.visible = false;
    character.carrySocket.add(envelope);
    this.root.add(character.root);
    this.friends.set(seat, {
      seat,
      kid,
      character,
      world: found?.world ?? null,
      samples: found?.samples ?? [],
      position: found?.position ?? new Vector3(),
      forward: found?.forward ?? new Vector3(0, 0, 1),
      envelope,
      shown: 0,
    });
  }

  remove(seat: number): void {
    const found = this.friends.get(seat);
    if (!found) return;
    this.root.remove(found.character.root);
    this.friends.delete(seat);
  }

  clear(): void {
    for (const seat of [...this.friends.keys()]) this.remove(seat);
  }

  /** Space suits on the Moon and Mars, like the local player. */
  setSuits(on: boolean): void {
    this.suits = on;
    for (const f of this.friends.values()) f.character.setSuit(on);
  }

  /** A new sample from the network. `now` is performance.now(). */
  push(seat: number, world: string, data: readonly number[], now: number): void {
    const f = this.friends.get(seat);
    if (!f) return;
    if (f.world !== world) {
      f.world = world;
      f.samples = [];
    }
    const bits = data[7] ?? 0;
    f.samples.push({
      at: now,
      position: new Vector3(data[0], data[1], data[2]),
      forward: new Vector3(data[3], data[4], data[5]),
      pace: data[6] ?? 0,
      carrying: (bits & 1) !== 0,
      seated: (bits & 2) !== 0,
    });
    if (f.samples.length > 12) f.samples.splice(0, f.samples.length - 12);
  }

  /** Friends who stand in `world`, with a known position. */
  here(world: string | null): Friend[] {
    return this.list.filter((f) => f.world === world && f.samples.length > 0);
  }

  update(dt: number, world: string | null, now: number, reducedMotion: boolean): void {
    const time = now - DELAY_MS;
    for (const f of this.friends.values()) {
      const visible = f.world === world && f.samples.length > 0;
      f.character.root.visible = visible;
      if (!visible) {
        f.shown = 0;
        continue;
      }
      f.shown += dt;
      // The two samples around the moment being drawn.
      const s = f.samples;
      let a = s[0]!;
      let b = s[0]!;
      for (let i = s.length - 1; i >= 0; i -= 1) {
        if (s[i]!.at <= time) {
          a = s[i]!;
          b = s[Math.min(i + 1, s.length - 1)]!;
          break;
        }
      }
      const span = b.at - a.at;
      const k = span > 0 ? Math.min(1, Math.max(0, (time - a.at) / span)) : 1;
      const target = this.scratchTarget.copy(a.position).lerp(b.position, k);
      if (f.position.lengthSq() === 0 || f.position.distanceTo(target) > SNAP_DISTANCE) f.position.copy(target);
      else f.position.lerp(target, Math.min(1, dt * 18));
      f.forward.copy(a.forward).lerp(b.forward, k);

      // Stand them on the sphere, facing where they walk.
      this.up.copy(f.position).normalize();
      f.forward.addScaledVector(this.up, -f.forward.dot(this.up));
      if (f.forward.lengthSq() < 1e-6) f.forward.set(1, 0, 0).addScaledVector(this.up, -this.up.x);
      f.forward.normalize();
      this.side.crossVectors(this.up, f.forward).normalize();
      const root = f.character.root;
      root.matrix.makeBasis(this.side, this.up, f.forward);
      root.matrix.setPosition(f.position);
      root.matrix.decompose(root.position, root.quaternion, root.scale);

      // Still once the last sample is old: they stopped.
      const last = s[s.length - 1]!;
      const pace = now - last.at > 400 ? 0 : a.pace + (b.pace - a.pace) * k;
      f.envelope.visible = b.carrying;
      f.character.update(
        dt,
        { pace, running: pace > 1.3, grounded: true, verticalSpeed: 0, sinceLanding: 10, landingSpeed: 0, carrying: b.carrying, seated: b.seated },
        reducedMotion,
      );
    }
  }
  private readonly scratchTarget = new Vector3();

  /** A friend's head, for name tags, emotes and phrases. */
  head(seat: number): Vector3 | null {
    const f = this.friends.get(seat);
    if (!f || !f.character.root.visible) return null;
    return f.position.clone().addScaledVector(f.position.clone().normalize(), 1.5);
  }

  /** Plays a little emote bounce on a friend. */
  emote(seat: number): void {
    this.friends.get(seat)?.character.play("emote");
  }
}
