import { describe, expect, it } from "vitest";
import { parsePage } from "@/lib/scraper/parse-page";
import { companyFromPage, extractEvidence, isErrorPageTitle } from "@/lib/research/company";

const HTML = `<!doctype html>
<html>
  <head>
    <title>Northwind Logistics | Home</title>
    <meta name="description" content="Regional freight and claims processing." />
    <style>body { color: red }</style>
    <script>var tracking = "ignore me";</script>
  </head>
  <body>
    <h1>Freight operations</h1>
    <a href="/about">About</a>
    <a href="https://northwind.example.com/claims">Claims</a>
    <a href="mailto:hello@northwind.example.com">Email</a>
    <a href="javascript:void(0)">Bad</a>
    <script>document.write('<a href="/injected">x</a>')</script>
  </body>
</html>`;

describe("parsePage", () => {
  const parsed = parsePage(HTML, "https://northwind.example.com/");

  it("extracts the title and meta description", () => {
    expect(parsed.title).toBe("Northwind Logistics | Home");
    expect(parsed.description).toBe("Regional freight and claims processing.");
  });

  it("removes script and style content from the visible text", () => {
    expect(parsed.text).not.toContain("ignore me");
    expect(parsed.text).not.toContain("color: red");
    expect(parsed.text).toContain("Freight operations");
  });

  it("resolves relative links against the base url and drops non-http schemes", () => {
    expect(parsed.links).toContain("https://northwind.example.com/about");
    expect(parsed.links).toContain("https://northwind.example.com/claims");
    expect(parsed.links.some((link) => link.startsWith("mailto:"))).toBe(false);
    expect(parsed.links.some((link) => link.startsWith("javascript:"))).toBe(false);
  });

  it("decodes html entities in the text", () => {
    const result = parsePage("<p>Fish &amp; Chips&nbsp;Co</p>", "https://example.com/");
    expect(result.text).toContain("Fish & Chips");
  });
});

describe("companyFromPage", () => {
  it("derives domain, website and name from a page", () => {
    const company = companyFromPage(
      "https://www.northwind.example.com/about",
      "Northwind Logistics",
      "Freight operator",
    );
    expect(company?.domain).toBe("northwind.example.com");
    expect(company?.website).toBe("https://www.northwind.example.com");
    expect(company?.name).toBe("Northwind Logistics");
  });

  it("returns null for non-http urls", () => {
    expect(companyFromPage("ftp://example.com", "X", null)).toBeNull();
  });
});

describe("extractEvidence", () => {
  const text =
    "We provide claims processing services for regional carriers. " +
    "Our team reviews every intake form before approval. " +
    "Customers can track shipments online.";

  it("returns labelled snippets sourced from the page text", () => {
    const evidence = extractEvidence(text);
    expect(evidence.length).toBeGreaterThan(0);
    for (const item of evidence) {
      // Every excerpt must be a verbate slice of the source text.
      expect(text).toContain(item.excerpt.replace(/\.\.\.$/, "").trim());
      expect(item.label).toBeTruthy();
    }
  });

  it("returns nothing for empty text", () => {
    expect(extractEvidence("")).toEqual([]);
    expect(extractEvidence("   ")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(extractEvidence(text, 2).length).toBeLessThanOrEqual(2);
  });
});

describe("HTML entity decoding", () => {
  it("decodes named entities commonly found in page titles", () => {
    const page = parsePage(
      "<html><head><title>Acme &mdash; Plumbing &amp; Heating &rsquo;s Team</title></head><body></body></html>",
      "https://acme.example.com",
    );
    expect(page.title).toBe("Acme \u2014 Plumbing & Heating \u2019s Team");
  });

  it("decodes numeric and hex entities", () => {
    const page = parsePage(
      "<html><head><title>Best &#8212; Ever &#x26; Co</title></head><body></body></html>",
      "https://acme.example.com",
    );
    expect(page.title).toBe("Best \u2014 Ever & Co");
  });

  it("does not double-decode escaped ampersands", () => {
    const page = parsePage(
      "<html><head><title>Tom &amp;mdash; Jerry</title></head><body></body></html>",
      "https://acme.example.com",
    );
    expect(page.title).toBe("Tom &mdash; Jerry");
  });

  it("leaves unknown entities untouched", () => {
    const page = parsePage(
      "<html><head><title>Acme &notarealentity; Ltd</title></head><body></body></html>",
      "https://acme.example.com",
    );
    expect(page.title).toBe("Acme &notarealentity; Ltd");
  });
});

describe("error page titles", () => {
  it("detects http error and bot-wall titles", () => {
    for (const title of [
      "403 Forbidden",
      "404 Not Found",
      "Access denied",
      "Just a moment...",
      "Attention Required! | Cloudflare",
      "Error",
      "503 Service Unavailable",
      "Captcha",
    ]) {
      expect(isErrorPageTitle(title)).toBe(true);
    }
  });

  it("leaves real company titles alone", () => {
    for (const title of [
      "Emergency Plumber Manchester | 24 Hour Call-Out",
      "Error-Free Plumbing Ltd",
      "404 Plumbing Services",
    ]) {
      expect(isErrorPageTitle(title)).toBe(false);
    }
  });

  it("falls back to the domain instead of using an error title as the name", () => {
    const company = companyFromPage("https://myemergencyplumber.co.uk", "403 Forbidden", null);
    expect(company?.name).toBe("Myemergencyplumber");
    expect(company?.domain).toBe("myemergencyplumber.co.uk");
  });
});
