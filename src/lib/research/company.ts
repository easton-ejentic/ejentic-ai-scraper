export interface CompanyPageRecord {
  id: string;
  companyId: string;
  jobId: string;
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  crawledAt: string;
}

export interface CompanyRecord {
  id: string;
  name: string;
  domain: string;
  website: string;
  description: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  pageCount: number;
  jobIds: string[];
  pages: CompanyPageRecord[];
}

const COMPANY_NAME_SUFFIXES = /\s+(?:\||-|—|–)\s+(?:home|homepage|official site|welcome).*$/i;

/**
 * Titles served by error pages and bot walls. Crawling the public web means a
 * fair share of "403 Forbidden", "Just a moment..." and "Access denied" pages;
 * treating those as a company name would put junk in the results.
 */
const ERROR_PAGE_TITLE =
  /^(?:\d{3}\s+|)(?:forbidden|not found|access denied|unauthorized|error(?![-a-z])|service unavailable|internal server|bad gateway|just a moment|attention required|blocked|too many requests|page not found|captcha|robot check)\b/i;

export function isErrorPageTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return ERROR_PAGE_TITLE.test(title.trim());
}

export function companyFromPage(
  url: string,
  title: string | null,
): { domain: string; website: string; name: string } | null {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!domain || domain.includes("." ) === false) return null;
    // An error page's title is never the company name - fall back to the domain
    // so a blocked page still yields a usable, honest label.
    const usableTitle = isErrorPageTitle(title) ? null : title;
    const fallbackName = domain
      .split(".")[0]
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
    const rawName = (usableTitle || fallbackName).replace(COMPANY_NAME_SUFFIXES, "").trim();
    const name = rawName.length > 80 ? rawName.slice(0, 80).trim() : rawName;
    return { domain, website: `${parsed.protocol}//${parsed.hostname}`, name: name || domain };
  } catch {
    return null;
  }
}

const EVIDENCE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "services", pattern: /\b(services|solutions|we help|our services|what we do)\b/i },
  { label: "operations", pattern: /\b(operations|process|processing|intake|review|support|management|coordination)\b/i },
  { label: "customer-work", pattern: /\b(customers?|clients?|members?|patients?|policyholders?)\b/i },
  { label: "documents", pattern: /\b(documents?|forms?|records?|applications?|invoices?|claims?)\b/i },
  { label: "people", pattern: /\b(team|employees?|staff|agents?|advisors?|specialists?)\b/i },
];

export interface EvidenceSnippet {
  label: string;
  excerpt: string;
}

export function extractEvidence(text: string, limit = 6): EvidenceSnippet[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 45);
  const output: EvidenceSnippet[] = [];
  const seen = new Set<string>();
  for (const { label, pattern } of EVIDENCE_PATTERNS) {
    const sentence = sentences.find((s) => pattern.test(s) && !seen.has(s));
    if (!sentence) continue;
    const excerpt = sentence.length > 320 ? `${sentence.slice(0, 317).trim()}...` : sentence;
    output.push({ label, excerpt });
    seen.add(sentence);
    if (output.length >= limit) break;
  }
  return output;
}
