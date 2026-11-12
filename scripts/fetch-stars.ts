/**
 * Fetches the bright stars round Voyager 1's patch of sky from NASA HEASARC's
 * copy of the Yale Bright Star Catalog (table `bsc5p`), for the Finale's star
 * map, and writes `src/data/stars-voyager.json`.
 *
 * Usage: npx tsx scripts/fetch-stars.ts
 *
 * Star positions are measured facts; the catalog is credited in CREDITS.md.
 * The service answers in binary VOTable, decoded here: each row is a
 * length-prefixed name, then RA and Dec as doubles and V magnitude as a float.
 */
import { writeFileSync } from "node:fs";

const RA = [222, 296];
const DEC = [-22, 42];
const FAINTEST = 4.6;

const query = `SELECT name,ra,dec,vmag FROM bsc5p WHERE vmag<${FAINTEST} AND ra BETWEEN ${RA[0]} AND ${RA[1]} AND dec BETWEEN ${DEC[0]} AND ${DEC[1]}`;
const url = `https://heasarc.gsfc.nasa.gov/xamin/vo/tap/sync?REQUEST=doQuery&LANG=ADQL&QUERY=${encodeURIComponent(query)}`;
const response = await fetch(url, { headers: { "User-Agent": "pieces-of-home-build" } });
if (!response.ok) throw new Error(`HEASARC said ${response.status}`);
const xml = await response.text();
if (!xml.includes('value="OK"')) throw new Error(`HEASARC error: ${xml.slice(0, 400)}`);
const stream = /<STREAM encoding="base64">([\s\S]*?)<\/STREAM>/.exec(xml)?.[1];
if (!stream) throw new Error("No data stream in the reply");
const bytes = Buffer.from(stream.replace(/\s+/g, ""), "base64");

const stars: { hr: number; ra: number; dec: number; mag: number }[] = [];
for (let i = 0; i < bytes.length; ) {
  const n = bytes.readInt32BE(i);
  i += 4;
  const name = bytes.toString("utf8", i, i + n);
  i += n;
  const ra = bytes.readDoubleBE(i);
  const dec = bytes.readDoubleBE(i + 8);
  const mag = bytes.readFloatBE(i + 16);
  i += 20;
  stars.push({ hr: Number(name.replace(/\D/g, "")), ra: Number(ra.toFixed(4)), dec: Number(dec.toFixed(4)), mag: Number(mag.toFixed(2)) });
}
if (stars.length < 30) throw new Error(`Only ${stars.length} stars`);
stars.sort((a, b) => a.mag - b.mag);
console.log(`${stars.length} stars brighter than ${FAINTEST}`);

const head = {
  source: "Yale Bright Star Catalog, 5th revised edition (Hoffleit and Warren 1991), table bsc5p at NASA HEASARC",
  sourceUrl: "https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html",
  fetchedOn: new Date().toISOString().slice(0, 10),
  region: { ra: RA, dec: DEC, faintest: FAINTEST },
};
const lines = stars.map((s) => `    ${JSON.stringify(s)}`).join(",\n");
const json = `${JSON.stringify(head, null, 2).slice(0, -2)},\n  "stars": [\n${lines}\n  ]\n}\n`;
JSON.parse(json);
writeFileSync("src/data/stars-voyager.json", json);
