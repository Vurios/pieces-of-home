import data from "../data/facts.json";

/**
 * The only door to facts in game code. Call `fact` with a fact id in quotes so the fact check
 * can see every use. Using a fact that is still marked "verify", or one with
 * no source, fails `npm run check:facts`.
 */
export interface FactEntry {
  id: string;
  kid: string;
  /** A few words for tight spots such as the loader list. */
  short?: string;
  deeper: string;
  value: string;
  date: string | null;
  sourceTitle: string;
  sourceUrl: string;
  status: "checked" | "verify";
  checkedOn: string | null;
  note?: string;
  /** Decimal degrees, north positive. Only on location facts. */
  lat?: number;
  /** Decimal degrees, east positive, -180 to 180. Only on location facts. */
  lon?: number;
}

const byId = new Map<string, FactEntry>((data.facts as FactEntry[]).map((entry) => [entry.id, entry]));

export function fact(id: string): FactEntry {
  const entry = byId.get(id);
  if (!entry) throw new Error(`Unknown fact "${id}"`);
  return entry;
}

/** A location fact as latitude and longitude. Throws if the fact has no coordinates. */
export function factCoords(entry: FactEntry): { lat: number; lon: number } {
  if (typeof entry.lat !== "number" || typeof entry.lon !== "number") {
    throw new Error(`Fact "${entry.id}" has no coordinates`);
  }
  return { lat: entry.lat, lon: entry.lon };
}
