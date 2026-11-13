/**
 * Which kids are in the room right now, played by someone (Phase 06). The
 * workshop reads this to send its waiting friends home when a real friend
 * plays them, so there is never a second Nori.
 */
class Presence {
  kids: ReadonlySet<string> = new Set();

  set(kids: ReadonlySet<string>): void {
    this.kids = kids;
  }
}

export const presence = new Presence();
