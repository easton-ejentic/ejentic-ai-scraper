/**
 * One-off repair for records written before two parsing fixes landed:
 *
 *   1. Companies first recorded from a blocked page kept titles like
 *      "403 Forbidden" / "Attention Required! | Cloudflare" as their name.
 *   2. Named/numeric HTML entities (&mdash;, &#8212;, &amp;, ...) were not
 *      decoded, so names contained raw entity markup.
 *
 * Re-derives a clean name from the domain for (1) and decodes entities for (2).
 * Safe to re-run.
 *
 *   node scripts/repair-company-names.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_PATH = join(process.cwd(), ".data", "scraper.json");
const ERROR_PAGE_TITLE =
  /^(?:\d{3}\s+|)(?:forbidden|not found|access denied|unauthorized|error(?![-a-z])|service unavailable|internal server|bad gateway|just a moment|attention required|blocked|too many requests|page not found|captcha|robot check)\b/i;

const NAMED_ENTITIES = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  middot: "\u00b7",
  trade: "\u2122",
  reg: "\u00ae",
  copy: "\u00a9",
  pound: "\u00a3",
  euro: "\u20ac",
  deg: "\u00b0",
  times: "\u00d7",
};

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_full, hex) => fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_full, decimal) => fromCodePoint(parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (full, name) => {
      if (name.toLowerCase() === "amp") return full;
      return NAMED_ENTITIES[name.toLowerCase()] ?? full;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function fromCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

const database = JSON.parse(readFileSync(DATA_PATH, "utf8"));
let repaired = 0;

for (const company of database.companies ?? []) {
  const before = company.name ?? "";

  let next = decodeEntities(before);

  if (ERROR_PAGE_TITLE.test(next.trim())) {
    const fallback = (company.domain ?? "")
      .split(".")[0]
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
    if (fallback) next = fallback;
  }

  next = next.replace(/\s+/g, " ").trim();
  if (next === before) continue;

  console.log(`  ${JSON.stringify(before)}\n    -> ${JSON.stringify(next)}`);
  company.name = next;
  repaired += 1;
}

writeFileSync(DATA_PATH, JSON.stringify(database, null, 2));
console.log(`Repaired ${repaired} company name(s).`);

const remaining = (database.companies ?? []).filter(
  (company) => ERROR_PAGE_TITLE.test((company.name ?? "").trim()) || /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i.test(company.name ?? ""),
);
console.log(`Remaining suspicious names: ${remaining.length}`);
for (const company of remaining) console.log(`  - ${company.name} (${company.domain})`);
