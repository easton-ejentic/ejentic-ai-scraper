/**
 * Contact discovery: turning a crawled page into a reachable human.
 *
 * A "qualified lead" on its own is a company name plus a workflow description -
 * nobody can email that. This module closes the gap: it pulls email addresses
 * out of the page text the crawler already stored, works out whether each one
 * is a real person or a shared inbox, and verifies the address is deliverable.
 *
 * Scope note, deliberately: verification is DNS-level only. We resolve the
 * domain's MX records and reject addresses that cannot possibly receive mail.
 * We do NOT open an SMTP connection and issue RCPT TO. That technique is
 * widely blocked, frequently wrong (catch-all servers accept everything), and
 * probing someone's mail server uninvited is a good way to get a crawler
 * banned. DNS gives an honest, reproducible signal without any of that.
 */

import { resolveMx as dnsResolveMx } from "node:dns/promises";

export type EmailKind = "personal" | "role" | "generic" | "unknown";

export type VerificationStatus =
  | "invalid" // not a syntactically usable address
  | "disposable" // throwaway inbox, useless for outreach
  | "mx_missing" // domain publishes no mail exchanger
  | "mx_valid" // domain accepts mail
  | "unverified"; // not checked yet

export interface DiscoveredContact {
  email: string;
  kind: EmailKind;
  /** 0..1. How much we trust this address belongs to a real person here. */
  confidence: number;
  sourceUrl: string;
  /** Short snippet of page text around the match, for human review. */
  context: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifiedContact extends DiscoveredContact {
  verification: VerificationStatus;
  mxRecord: string | null;
  verifiedAt: string;
}

/** Shared inboxes. Reachable, but not a named individual. */
const GENERIC_LOCAL_PARTS = new Set([
  "info", "sales", "contact", "hello", "hi", "enquiries", "enquiry", "inquiries",
  "support", "help", "team", "office", "admin", "mail", "email", "queries",
  "service", "services", "customerservice", "care", "reception", "front desk",
]);

/** Functional roles. Still a shared mailbox, but a specific function. */
const ROLE_LOCAL_PARTS = new Set([
  "billing", "accounts", "accounting", "finance", "invoice", "invoices", "orders",
  "hr", "jobs", "careers", "recruitment", "marketing", "press", "media", "pr",
  "legal", "privacy", "security", "abuse", "postmaster", "webmaster", "noreply",
  "no-reply", "donotreply", "newsletter", "bookings", "reservations", "claims",
  "underwriting", "newbusiness", "partnerships", "procurement",
]);

/** Consumer mailboxes. Legitimate for sole traders, weak for a real company. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "hotmail.co.uk", "outlook.com", "live.com", "msn.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
  "gmx.com", "gmx.de", "mail.com", "yandex.com", "zoho.com", "qq.com", "163.com",
]);

/** Throwaway inboxes. Verifying these is pointless. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "tempmail.net", "temp-mail.org", "throwawaymail.com", "yopmail.com",
  "trashmail.com", "sharklasers.com", "getnada.com", "maildrop.cc",
  "dispostable.com", "mailnesia.com", "fakeinbox.com", "spamgourmet.com",
  "jetable.org", "mintemail.com", "emailondeck.com", "mohmal.com",
]);

/**
 * Addresses that appear in page source but belong to nobody at the company:
 * tracking pixels, CDN edges, boilerplate templates and framework placeholders.
 */
const PLACEHOLDER_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "domain.com", "yourdomain.com",
  "email.com", "test.com", "company.com", "sentry.io", "wixpress.com",
  "godaddy.com", "squarespace.com", "cloudflare.com", "googleapis.com",
  "gstatic.com", "schema.org", "w3.org", "adobe.com", "jquery.com",
  "wordpress.org", "wordpress.com", "shopify.com", "reactjs.org",
  "github.com", "unsplash.com", "placeholder.com", "via.placeholder.com",
]);

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;

/**
 * Undo the obfuscation people use to slow down scrapers.
 *
 * Only unambiguous bracket/paren/entity forms are rewritten. Bare " at " and
 * " dot " are left alone: rewriting those turns ordinary prose into false
 * positives ("email us at the address below").
 */
export function deobfuscate(text: string): string {
  return text
    .replace(/&#x0*40;|&#0*64;|%40/gi, "@")
    .replace(/\s*[[(]\s*(?:at|@)\s*[\])]\s*/gi, "@")
    .replace(/\s*[[(]\s*(?:dot|\.)\s*[\])]\s*/gi, ".");
}

/** Domains whose MX answer is cached for the life of the process. */
const mxCache = new Map<string, string | null>();

export interface MxResolver {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
}

const defaultResolver: MxResolver = {
  async resolveMx(domain) {
    return dnsResolveMx(domain);
  },
};

function normaliseLocalPart(localPart: string): string {
  return localPart.toLowerCase().replace(/\d+/g, "");
}

export function classifyEmail(localPart: string): EmailKind {
  const cleaned = normaliseLocalPart(localPart);
  if (GENERIC_LOCAL_PARTS.has(cleaned)) return "generic";
  if (ROLE_LOCAL_PARTS.has(cleaned)) return "role";
  return "personal";
}

/**
 * Split a local part into a plausible human name.
 *
 * Handles `john.smith`, `j.smith`, `john_smith` and `john-smith`. A single
 * unsplittable blob (`johnsmith`) is left nameless rather than guessed - an
 * invented first name is worse than none.
 */
export function nameFromLocalPart(
  localPart: string,
): { firstName?: string; lastName?: string } {
  const cleaned = localPart.replace(/\d+/g, "");
  const parts = cleaned.split(/[._-]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return {};

  const words = parts.filter((part) => /^[a-z]{1,20}$/i.test(part));
  if (words.length < 2) return {};

  const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  const firstName = capitalise(words[0]);
  const lastName = capitalise(words[words.length - 1]);
  if (firstName.length < 2 || lastName.length < 2) return {};
  return { firstName, lastName };
}

/**
 * How much we trust the address, given the company's own domain.
 *
 * An address on the company's domain beats a Gmail address, and a named person
 * beats a shared inbox - but a small business whose only published address is
 * `info@` is still a real lead, so nothing here scores zero.
 */
function scoreContact(
  email: string,
  domain: string,
  kind: EmailKind,
  companyDomain: string | null,
): number {
  if (DISPOSABLE_DOMAINS.has(domain)) return 0.05;

  const onCompanyDomain = Boolean(companyDomain) && domain === companyDomain;
  const isFreeMail = FREE_MAIL_DOMAINS.has(domain);

  if (onCompanyDomain) {
    if (kind === "personal") return 0.9;
    if (kind === "role") return 0.72;
    return 0.68; // generic inbox, but unmistakably this company
  }

  if (isFreeMail) return kind === "personal" ? 0.4 : 0.3;

  // Some other domain: could be a parent company, an agency, or a stale
  // template. Weak either way.
  return kind === "personal" ? 0.35 : 0.25;
}

export interface ExtractOptions {
  /** The company's own domain, used to weight on-domain addresses higher. */
  companyDomain?: string | null;
  /** Cap on addresses returned per page. */
  limit?: number;
}

/**
 * Pull candidate contacts out of one page of crawled text.
 *
 * Returns a de-duplicated, highest-confidence-first list. Junk domains and
 * obvious boilerplate are dropped before scoring rather than scored low, so a
 * page full of tracking pixels cannot crowd out a real address.
 */
export function extractContacts(
  text: string,
  sourceUrl: string,
  options: ExtractOptions = {},
): DiscoveredContact[] {
  if (!text) return [];

  const prepared = deobfuscate(text);
  const limit = options.limit ?? 12;
  const companyDomain = options.companyDomain?.toLowerCase() ?? null;
  const found = new Map<string, DiscoveredContact>();

  for (const match of prepared.matchAll(EMAIL_PATTERN)) {
    const raw = match[0];
    const email = raw.toLowerCase();
    const atIndex = email.indexOf("@");
    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    if (!localPart || localPart.length < 2) continue;
    if (PLACEHOLDER_DOMAINS.has(domain)) continue;
    // Reject anything that is really a filename or a CSS artefact.
    if (/\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|ico)$/i.test(email)) continue;
    if (found.has(email)) continue;

    const kind = classifyEmail(localPart);
    const confidence = scoreContact(email, domain, kind, companyDomain);
    const start = Math.max(0, (match.index ?? 0) - 60);
    const context = text.slice(start, (match.index ?? 0) + raw.length + 60).replace(/\s+/g, " ").trim();

    found.set(email, {
      email,
      kind,
      confidence,
      sourceUrl,
      context,
      ...nameFromLocalPart(localPart),
    });
  }

  return [...found.values()]
    .sort((a, b) => b.confidence - a.confidence || a.email.localeCompare(b.email))
    .slice(0, limit);
}

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

/**
 * DNS-level deliverability check.
 *
 * Resolves MX records for the domain and reports what it found. Results are
 * cached because a crawl will hit the same domain many times, and DNS is the
 * slow part of this.
 */
export async function verifyEmail(
  email: string,
  resolver: MxResolver = defaultResolver,
): Promise<{ status: VerificationStatus; mxRecord: string | null }> {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) {
    return { status: "invalid", mxRecord: null };
  }

  const domain = email.slice(atIndex + 1).toLowerCase();
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain)) {
    return { status: "invalid", mxRecord: null };
  }
  if (isDisposableDomain(domain)) {
    return { status: "disposable", mxRecord: null };
  }

  if (mxCache.has(domain)) {
    const cached = mxCache.get(domain) ?? null;
    return { status: cached ? "mx_valid" : "mx_missing", mxRecord: cached };
  }

  try {
    const records = await resolver.resolveMx(domain);
    const best = records
      .filter((record) => Boolean(record.exchange))
      .sort((a, b) => a.priority - b.priority)[0];
    const exchange = best ? best.exchange.replace(/\.$/, "") : null;
    mxCache.set(domain, exchange);
    return { status: exchange ? "mx_valid" : "mx_missing", mxRecord: exchange };
  } catch {
    // NXDOMAIN, no MX, or DNS unreachable. All mean "cannot deliver".
    mxCache.set(domain, null);
    return { status: "mx_missing", mxRecord: null };
  }
}

/** Verify a batch, preserving input order. */
export async function verifyContacts(
  contacts: DiscoveredContact[],
  resolver: MxResolver = defaultResolver,
): Promise<VerifiedContact[]> {
  const verifiedAt = new Date().toISOString();
  return Promise.all(
    contacts.map(async (contact) => {
      const { status, mxRecord } = await verifyEmail(contact.email, resolver);
      return { ...contact, verification: status, mxRecord, verifiedAt };
    }),
  );
}

/** Contacts worth showing: real syntax, deliverable domain, not disposable. */
export function isOutreachReady(contact: VerifiedContact): boolean {
  return contact.verification === "mx_valid";
}
