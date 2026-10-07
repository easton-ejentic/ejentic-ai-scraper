import { normalizeUrl } from "./url";

export interface ParsedPage {
  title: string | null;
  description: string | null;
  text: string;
  links: string[];
}

/** Entities that show up constantly in real-world `<title>` and meta tags. */
const NAMED_ENTITIES: Record<string, string> = {
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
  yen: "\u00a5",
  deg: "\u00b0",
  times: "\u00d7",
  shy: "",
};

export function decodeHtml(value: string): string {
  return value
    // Numeric entities first, so `&#8212;` never becomes a named-entity lookup.
    .replace(/&#x([0-9a-f]+);/gi, (_full, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_full, decimal: string) => safeCodePoint(parseInt(decimal, 10)))
    // Named entities, but never `&amp;` here: decoding it first would turn
    // `&amp;mdash;` into a dash the page never contained.
    .replace(/&([a-z]+);/gi, (full, name: string) => {
      if (name.toLowerCase() === "amp") return full;
      return NAMED_ENTITIES[name.toLowerCase()] ?? full;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function parsePage(html: string, baseUrl: string): ParsedPage {
  const withoutExecutableContent = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ");

  const titleMatch = withoutExecutableContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descriptionMatch = withoutExecutableContent.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
  );

  const links = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(withoutExecutableContent)) !== null) {
    try {
      const absolute = normalizeUrl(new URL(decodeHtml(match[1]), baseUrl).toString());
      if (absolute) links.add(absolute);
    } catch {
      // Ignore malformed links.
    }
  }

  const text = decodeHtml(
    withoutExecutableContent
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  return {
    title: titleMatch ? decodeHtml(titleMatch[1]).replace(/\s+/g, " ").trim() || null : null,
    description: descriptionMatch ? decodeHtml(descriptionMatch[1]).trim() || null : null,
    text,
    links: [...links],
  };
}
