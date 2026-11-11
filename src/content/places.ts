/**
 * The places on Home a player can find. Walking into one shows its name and
 * a short line. Grade 3 to 5 wording, no em dashes, no facts or numbers (the
 * places are made up, so nothing here needs a source).
 *
 * The ids match `PLACES` in `src/game/worlds/home/layout.ts`.
 */
export interface PlaceCopy {
  name: string;
  line: string;
}

export const PLACE_COPY: Record<string, PlaceCopy> = {
  home: { name: "Home", line: "Mom's porch light is on. The mailbox is by the path." },
  workshop: { name: "Dad's Workshop", line: "Tools, wires, and a lamp that still turns on." },
  garden: { name: "Mom's Garden", line: "Carrots, pumpkins, and four tall sunflowers." },
  dish: { name: "The Backyard Dish", line: "Dad pointed it at the sky to listen." },
  hill: { name: "Lookout Hill", line: "The best seat for watching the stars come out." },
  meadow: { name: "Swing Meadow", line: "A rope swing, a picnic, and a kite on a string." },
  treehouse: { name: "The Treehouse", line: "Dad built it up high. Remi painted the door red." },
  playground: { name: "The Playground", line: "A slide, a seesaw, and a sandcastle with four towers." },
  pond: { name: "Lily Pond", line: "A frog, a little rowboat, and a fishing line in the water." },
  camp: { name: "Campfire Camp", line: "A tent, a warm fire, and sticks for marshmallows." },
  weather: { name: "Weather Station", line: "Dad's little cups spin when the wind blows." },
  rocket: { name: "Rocket Field", line: "Dad's model rocket, waiting for launch day." },
  orchard: { name: "The Orchard", line: "Apple trees and two busy beehives. Let the bees work." },
  windpump: { name: "The Windpump", line: "When the wind turns the wheel, it pumps water for the birds." },
  balloon: { name: "Balloon Field", line: "Dad's balloon is tied down tight. It only goes as high as the rope." },
};

export const PLACE_IDS = Object.keys(PLACE_COPY);

/** The story flag set the first time a place is found. */
export const placeFlag = (id: string): string => `place:${id}`;

/** How many places the player has found so far. */
export function placesFound(flags: readonly string[]): number {
  return PLACE_IDS.filter((id) => flags.includes(placeFlag(id))).length;
}
