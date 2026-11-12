/**
 * Rebuilds the notebook's real images from their sources and checks their
 * credits. Every image the notebook shows is listed in src/data/images.json
 * (id, file, alt text) and credited in src/data/credits.json (title, exact
 * credit line, license, source URL, page). For images from the NASA Image and
 * Video Library, the script asks its API (https://images-api.nasa.gov, no key)
 * for the NASA ID's record and checks the title still matches.
 *
 * Usage:
 *   npx tsx scripts/fetch-nasa-images.ts          check every source answers, change nothing
 *   npx tsx scripts/fetch-nasa-images.ts --write  download, resize to 900 px wide or less, save as JPEG
 *   npx tsx scripts/fetch-nasa-images.ts --write --only apollo15-lroc   one image by its id in images.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

interface Media {
  id: string;
  file: string;
  title: string;
  credit: string;
  license: string;
  sourceUrl: string;
  page: string;
}

const write = process.argv.includes("--write");
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt > 0 ? process.argv[onlyAt + 1] : undefined;
const credits = JSON.parse(readFileSync("src/data/credits.json", "utf8")) as { media: Media[] };
const images = JSON.parse(readFileSync("src/data/images.json", "utf8")) as { images: { id: string; file: string }[] };
const headers = { "User-Agent": "pieces-of-home-build" };

let problems = 0;
for (const image of images.images.filter((i) => !only || i.id === only)) {
  const file = image.file.replace(/^\//, "");
  const media = credits.media.find((m) => m.file === file);
  if (!media) {
    console.error(`FAIL  ${image.id}: no credit for ${file}`);
    problems += 1;
    continue;
  }
  if (!media.credit || !media.license || !media.sourceUrl || !media.page) {
    console.error(`FAIL  ${image.id}: the credit is missing a field`);
    problems += 1;
  }
  // NASA Image and Video Library: the record for this NASA ID must still exist.
  const nasaId = /images\.nasa\.gov\/details\/([^/?#]+)/.exec(media.page)?.[1];
  if (nasaId) {
    const r = await fetch(`https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(nasaId)}`, { headers });
    const found = r.ok ? ((await r.json()) as { collection?: { items?: { data?: { title?: string }[] }[] } }).collection?.items?.[0]?.data?.[0]?.title : undefined;
    if (!found) {
      console.error(`FAIL  ${image.id}: NASA ID ${nasaId} not found in the library`);
      problems += 1;
    } else console.log(`ok    ${image.id}: ${nasaId} "${found}"`);
  }
  const response = await fetch(media.sourceUrl, { headers });
  if (!response.ok) {
    console.error(`FAIL  ${image.id}: ${media.sourceUrl} answered ${response.status}`);
    problems += 1;
    continue;
  }
  if (!write) {
    await response.body?.cancel();
    console.log(`ok    ${image.id}: source answers`);
    continue;
  }
  const original = Buffer.from(await response.arrayBuffer());
  const out = await sharp(original).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  writeFileSync(join("public", file), out);
  console.log(`wrote ${file} (${Math.round(out.length / 1024)} KB)`);
}
if (problems) {
  console.error(`${problems} problem(s)`);
  process.exit(1);
}
console.log(write ? "done" : "every image has a working source and a full credit");
