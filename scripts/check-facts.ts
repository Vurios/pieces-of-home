/**
 * `npm run check:facts`
 *
 * Fails when a checked fact has no source, when game text references a fact
 * that is missing, unsourced or still marked verify.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type ContentFile, type Fact, checkFacts } from "./lib/fact-check";

const root = fileURLToPath(new URL("..", import.meta.url));
const FACTS_PATH = join(root, "src", "data", "facts.json");

// Everything a player can read: content data, UI, game code, strings and the entry page.
const SCAN_DIRS = ["src/content", "src/ui", "src/game", "src/audio", "src/data", "src/boot", "scripts/vite"];
const SCAN_FILES = ["index.html", "src/main.ts"];
const SCAN_EXTENSIONS = new Set([".ts", ".svelte", ".json", ".html", ".md"]);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) out.push(full);
  }
}

const paths: string[] = SCAN_FILES.map((file) => join(root, file));
for (const dir of SCAN_DIRS) walk(join(root, dir), paths);

const files: ContentFile[] = paths
  .filter((path) => path !== FACTS_PATH)
  .map((path) => ({ path: relative(root, path).replaceAll("\\", "/"), text: readFileSync(path, "utf8") }));

const { facts } = JSON.parse(readFileSync(FACTS_PATH, "utf8")) as { facts: Fact[] };
const report = checkFacts(facts, files);

for (const warning of report.warnings) console.warn(`warn  ${warning}`);
for (const error of report.errors) console.error(`FAIL  ${error}`);

const checked = facts.filter((fact) => fact.status === "checked").length;
console.log(
  `check:facts  ${facts.length} facts (${checked} checked), ${report.used.length} used across ${files.length} files, ${report.errors.length} errors.`,
);
process.exit(report.errors.length > 0 ? 1 : 0);
