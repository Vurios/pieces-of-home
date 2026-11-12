/**
 * Pure fact-checking rules, shared by `npm run check:facts` and the unit tests.
 *
 * A fact reference in content looks like `[F:fact-id]`, `{F:fact-id}`,
 * `fact("fact-id")` or a chapter script line `{ fact: "fact-id" }`. Player-facing numbers must always come from a reference.
 */

export interface Fact {
  id: string;
  kid: string;
  short?: string;
  deeper: string;
  value: string;
  date: string | null;
  sourceTitle: string;
  sourceUrl: string;
  status: "checked" | "verify";
  checkedOn: string | null;
  note?: string;
}

export interface ContentFile {
  path: string;
  text: string;
}

export interface FactReport {
  errors: string[];
  warnings: string[];
  used: string[];
}

// Chapter scripts name facts as `fact: "fact-id"` inside their lines, so those count too.
const REFERENCE_PATTERNS = [/[[{]F:([a-z0-9-]+)[\]}]/g, /\bfact\(\s*["'`]([a-z0-9-]+)["'`]\s*\)/g, /\bfact:\s*["'`]([a-z0-9-]+)["'`]/g];
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function findFactReferences(text: string): string[] {
  const ids = new Set<string>();
  for (const pattern of REFERENCE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) ids.add(match[1]);
    }
  }
  return [...ids];
}

function hasSource(fact: Fact): boolean {
  return fact.sourceTitle.trim().length > 0 && /^https:\/\/\S+$/.test(fact.sourceUrl);
}

export function checkFacts(facts: Fact[], files: ContentFile[]): FactReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map<string, Fact>();

  for (const fact of facts) {
    if (!ID_PATTERN.test(fact.id)) errors.push(`Fact "${fact.id}" has a bad id. Use lowercase words joined by dashes.`);
    if (byId.has(fact.id)) errors.push(`Fact "${fact.id}" appears more than once.`);
    byId.set(fact.id, fact);

    if (fact.kid.trim().length === 0) errors.push(`Fact "${fact.id}" has no kid wording.`);
    if (fact.kid.includes("—")) errors.push(`Fact "${fact.id}" uses an em dash in its kid wording.`);
    if (fact.short?.includes("—")) errors.push(`Fact "${fact.id}" uses an em dash in its short wording.`);
    if (fact.status !== "checked" && fact.status !== "verify") {
      errors.push(`Fact "${fact.id}" has an unknown status "${String(fact.status)}".`);
    }
    // A checked fact without a source is a broken promise.
    if (fact.status === "checked" && !hasSource(fact)) {
      errors.push(`Fact "${fact.id}" is marked checked but has no source title and https URL.`);
    }
  }

  const used = new Set<string>();
  for (const file of files) {
    for (const id of findFactReferences(file.text)) {
      used.add(id);
      const fact = byId.get(id);
      if (!fact) {
        errors.push(`${file.path} references missing fact "${id}".`);
        continue;
      }
      if (!hasSource(fact)) errors.push(`${file.path} uses fact "${id}", which has no source.`);
      if (fact.status === "verify") errors.push(`${file.path} uses fact "${id}", which is still marked verify.`);
    }
  }

  const unverified = facts.filter((fact) => fact.status === "verify").length;
  if (unverified > 0) warnings.push(`${unverified} facts are still marked verify. They cannot be used in the game yet.`);
  const unopened = facts.filter((fact) => fact.status === "checked" && fact.checkedOn === null).length;
  if (unopened > 0) warnings.push(`${unopened} checked facts have no checkedOn date. Open each source and record the date.`);

  return { errors, warnings, used: [...used].sort() };
}
