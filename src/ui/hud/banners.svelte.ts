/**
 * Big paper cards in the middle of the screen take turns, so two never show
 * at once. The chapter card holds the stage while it is up; a place card
 * that arrives meanwhile waits until it is gone.
 */
class Banners {
  /** True while the chapter card ("Prologue / The Workshop") is showing. */
  chapter = $state(false);
}

export const banners = new Banners();
