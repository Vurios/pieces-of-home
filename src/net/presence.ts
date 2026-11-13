/**
 * Who is in the room right now, for the parts of the game that are not the
 * co-op bridge (Phase 06):
 * - which kids are played by someone, so the workshop sends its waiting
 *   friends home and there is never a second Nori;
 * - which friends hold a station steady for the local player, so a station's
 *   game can say so and be a little kinder.
 */
type Listener = () => void;

class Presence {
  kids: ReadonlySet<string> = new Set();
  /** Kids holding steady the station game the local player is playing now. */
  helpers: readonly string[] = [];
  private listeners = new Set<Listener>();

  set(kids: ReadonlySet<string>): void {
    this.kids = kids;
    this.changed();
  }

  setHelpers(helpers: readonly string[]): void {
    if (helpers.length === this.helpers.length && helpers.every((h, i) => h === this.helpers[i])) return;
    this.helpers = helpers;
    this.changed();
  }

  /** True while at least one friend holds the local player's station steady. */
  get steady(): boolean {
    return this.helpers.length > 0;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener();
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }
}

export const presence = new Presence();
