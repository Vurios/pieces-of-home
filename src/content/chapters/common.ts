/**
 * Words every chapter shares: the next letter, the parcel for Milo, the dome
 * labels. Grade 3 to 5, no em dashes, no numbers.
 */
export const STORY_COPY = {
  nextLetter: "Next letter:",
  partFound: "Look, a parcel by Dad's tag. It has Milo's name on it!",
  partTaken: "It's for Milo. Step into the lamp light to take it home.",
  saved: "Saved in Dad's notebook",
  visit: (place: string): string => `Visit ${place}`,
  rocket: "Fly Dad's rocket",
  goHome: "Go back to the workshop",
  takeHome: "Take the part home",
} as const;
