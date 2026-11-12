import table from "../data/voyager1.json";

/**
 * Voyager 1 for today's date, from the JPL Horizons table fetched at build
 * time (`scripts/fetch-horizons.ts`, one row a day at 00:00 UT). Between rows
 * it interpolates; before or after the table it holds the nearest row, and
 * says so with `inRange`.
 */
export interface VoyagerToday {
  /** Distance from Earth's center, in AU and km. */
  au: number;
  km: number;
  /** One-way light time, in minutes. */
  lightMinutes: number;
  /** Where it sits in Earth's sky (ICRF), in degrees. */
  ra: number;
  dec: number;
  inRange: boolean;
}

interface Row {
  date: string;
  au: number;
  km: number;
  lightMinutes: number;
  ra: number;
  dec: number;
}

const rows = (table as { rows: Row[] }).rows;
const DAY = 86_400_000;
const at = (row: Row): number => Date.parse(`${row.date}T00:00:00Z`);

export const VOYAGER_SOURCE = { title: "JPL Horizons System (Voyager 1, target -31)", url: (table as { sourceUrl: string }).sourceUrl };

export function voyagerOn(when: Date = new Date()): VoyagerToday {
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const t = when.getTime();
  const pick = (row: Row, inRange: boolean): VoyagerToday => ({ au: row.au, km: row.km, lightMinutes: row.lightMinutes, ra: row.ra, dec: row.dec, inRange });
  if (!Number.isFinite(t) || t <= at(first)) return pick(first, t === at(first));
  if (t >= at(last)) return pick(last, t === at(last));
  const i = Math.min(rows.length - 2, Math.floor((t - at(first)) / DAY));
  const a = rows[i]!;
  const b = rows[i + 1]!;
  const k = (t - at(a)) / (at(b) - at(a));
  const mix = (x: number, y: number): number => x + (y - x) * k;
  return { au: mix(a.au, b.au), km: mix(a.km, b.km), lightMinutes: mix(a.lightMinutes, b.lightMinutes), ra: mix(a.ra, b.ra), dec: mix(a.dec, b.dec), inRange: true };
}

/** "24 hours and 2 minutes", rounded to the nearest minute, for kids. */
export function hoursAndMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hours = `${h} ${h === 1 ? "hour" : "hours"}`;
  if (m === 0) return hours;
  return `${hours} and ${m} ${m === 1 ? "minute" : "minutes"}`;
}

/** The light-day moment from the NASA fact (`v1-light-day`): Nov. 18, 2026, 10:16:07 UTC. */
export const LIGHT_DAY = Date.parse("2026-11-18T10:16:07Z");
