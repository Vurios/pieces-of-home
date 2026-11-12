/**
 * Big paper cards in the middle of the screen take turns, so two never show
 * at once. The chapter card holds the stage while it is up; a place card
 * that arrives meanwhile waits until it is gone.
 */
class Banners {
  /** True while the chapter card ("Prologue / The Workshop") is showing. */
  chapter = $state(false);
  /** True while the travel screen covers a trip through the Looking Lamp. */
  traveling = $state(false);
  /** How many full-screen story screens are up (the star map, Milo's projector, the last page, the ending). */
  screens = $state(0);
  /** True while a big card or the travel screen has the stage. */
  get busy(): boolean {
    return this.chapter || this.traveling;
  }
}

export const banners = new Banners();
