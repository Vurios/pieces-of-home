/**
 * Fetches Voyager 1's place in the sky and its distance from Earth from the
 * JPL Horizons API (no key needed), one row a day from 2026-11-01 to
 * 2028-12-31, and writes `src/data/voyager1.json`. The game interpolates for
 * today's date and holds the nearest row outside the range.
 *
 * Usage: npx tsx scripts/fetch-horizons.ts
 *
 * Quantities: 1 (astrometric RA and Dec), 20 (observer range), 21 (one-way
 * light time). Observer: Earth's center (500@399). Target: -31 (Voyager 1).
 */
import { writeFileSync } from "node:fs";

const START = "2026-11-01";
const STOP = "2028-12-31";
const AU_KM = 149_597_870.7;

const params = new URLSearchParams({
  format: "json",
  COMMAND: "'-31'",
  OBJ_DATA: "'NO'",
  MAKE_EPHEM: "'YES'",
  EPHEM_TYPE: "'OBSERVER'",
  CENTER: "'500@399'",
  START_TIME: `'${START}'`,
  STOP_TIME: `'${STOP}'`,
  STEP_SIZE: "'1 d'",
  QUANTITIES: "'1,20,21'",
  ANG_FORMAT: "'DEG'",
  CSV_FORMAT: "'YES'",
  CAL_FORMAT: "'CAL'",
  TIME_DIGITS: "'MINUTES'",
});

const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
const response = await fetch(url, { headers: { "User-Agent": "pieces-of-home-build" } });
if (!response.ok) throw new Error(`Horizons said ${response.status}`);
const body = (await response.json()) as { result?: string; error?: string };
if (body.error || !body.result) throw new Error(`Horizons error: ${body.error ?? "no result"}`);
const text = body.result;
const start = text.indexOf("$$SOE");
const end = text.indexOf("$$EOE");
if (start < 0 || end < 0) throw new Error("No ephemeris block in the Horizons reply");

// The header row just above $$SOE names the columns.
const header = text.slice(0, start).trim().split("\n").filter((l) => l.includes("Date__(UT)__HR:MN")).pop();
if (!header) throw new Error("No column header in the Horizons reply");
const columns = header.split(",").map((c) => c.trim());
const col = (name: string): number => {
  const i = columns.findIndex((c) => c.startsWith(name));
  if (i < 0) throw new Error(`Missing column ${name} in: ${columns.join(" | ")}`);
  return i;
};
const iDate = col("Date__(UT)__HR:MN");
const iRa = col("R.A._(ICRF)");
const iDec = col("DEC_(ICRF)");
const iDelta = col("delta");
const iLight = col("1-way_down_LT");

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

interface Row {
  date: string;
  km: number;
  au: number;
  /** One-way light time in minutes. */
  lightMinutes: number;
  ra: number;
  dec: number;
}
const rows: Row[] = [];
for (const line of text.slice(start + 5, end).trim().split("\n")) {
  const cells = line.split(",").map((c) => c.trim());
  const [y, m, d] = (cells[iDate] ?? "").split(" ")[0]!.split("-");
  const au = Number(cells[iDelta]);
  rows.push({
    date: `${y}-${MONTHS[m!] ?? m}-${d}`,
    au: Number(au.toFixed(6)),
    km: Math.round(au * AU_KM),
    lightMinutes: Number(Number(cells[iLight]).toFixed(3)),
    ra: Number(Number(cells[iRa]).toFixed(4)),
    dec: Number(Number(cells[iDec]).toFixed(4)),
  });
}
if (rows.length < 700) throw new Error(`Only ${rows.length} rows`);
for (const r of rows) {
  if (![r.au, r.km, r.lightMinutes, r.ra, r.dec].every(Number.isFinite)) throw new Error(`Bad row ${JSON.stringify(r)}`);
}

const milestone = rows.find((r) => r.date === "2026-11-18");
console.log(`rows ${rows.length}; 2026-11-18 light time ${milestone ? (milestone.lightMinutes / 60).toFixed(3) : "?"} h`);

// One row per line: small, and easy to read in a diff.
const head = {
  source: "JPL Horizons API, target -31 (Voyager 1), observer 500@399 (Earth's center), quantities 1, 20, 21, daily at 00:00 UT",
  sourceUrl: "https://ssd.jpl.nasa.gov/horizons/",
  fetchedOn: new Date().toISOString().slice(0, 10),
};
const lines = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
const json = `${JSON.stringify(head, null, 2).slice(0, -2)},\n  "rows": [\n${lines}\n  ]\n}\n`;
JSON.parse(json);
writeFileSync("src/data/voyager1.json", json);
