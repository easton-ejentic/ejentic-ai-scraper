import { describe, expect, it, vi, afterEach } from "vitest";

import {
  extractTargetUrl,
  parseDuckDuckGoHtml,
  stripTags,
  DuckDuckGoProvider,
} from "../src/lib/discovery/providers/duckduckgo";
import {
  BingProvider,
  extractTargetUrl as extractBingTargetUrl,
  isChallengePage as isChallengePageFn,
  parseBingHtml,
} from "../src/lib/discovery/providers/bing";
import { BraveSearchProvider } from "../src/lib/discovery/providers/brave";
import { buildQueries, describeSearch, hasSearchableInput } from "../src/lib/discovery/query";
import {
  classifyResult,
  isBusinessLike,
  rankCandidates,
  registrableDomain,
} from "../src/lib/discovery/ranking";
import { discoverBusinessUrls, providerStatus } from "../src/lib/discovery";
import {
  domainToUrl,
  resolveJobTarget,
  splitUrlList,
  targetLabelFor,
} from "../src/lib/scraper/resolve-target";
import type { JobDraft } from "../src/lib/scraper/job-types";
import type { SearchResult } from "../src/lib/discovery/types";

afterEach(() => {
  delete process.env.BRAVE_SEARCH_API_KEY;
  vi.unstubAllGlobals();
});

/**
 * A mocked Response body can only be consumed once, and discovery may call
 * several providers for the same query. Build a fresh Response per call.
 */
function htmlFetch(html: string, status = 200) {
  return vi.fn().mockImplementation(() => Promise.resolve(new Response(html, { status })));
}

/** Shape of a real DuckDuckGo HTML response, trimmed to two results. */
const DDG_FIXTURE = `
<div class="result results_links">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.emergencyplumbingmanchester.co.uk%2F&amp;rut=abc123">
      <b>Emergency</b> Plumbers <b>Manchester</b> | 24/7 Callout
    </a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.emergencyplumbingmanchester.co.uk%2F">
    Fast <b>emergency plumbing</b> across Manchester, available 24 hours a day.
  </a>
</div>
<div class="result results_links">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.checkatrade.com%2Fblog%2Fplumbers%2Fmanchester%2F">
      Compare 44 Checked <b>Plumbers</b> in Manchester
    </a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.checkatrade.com%2Fblog%2Fplumbers%2Fmanchester%2F">
    Read reviews of <b>plumbers</b> near you.
  </a>
</div>
`;

describe("DuckDuckGo parsing", () => {
  it("strips tags and decodes entities", () => {
    expect(stripTags("<b>Emergency</b> Plumbers &amp; Heating")).toBe(
      "Emergency Plumbers & Heating",
    );
  });

  it("unwraps the uddg redirect to the real destination", () => {
    expect(
      extractTargetUrl(
        "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage%3Fid%3D1&rut=xyz",
      ),
    ).toBe("https://example.com/page?id=1");
  });

  it("accepts a direct link that is not a duckduckgo redirect", () => {
    expect(extractTargetUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("rejects links with no resolvable destination", () => {
    expect(extractTargetUrl("//duckduckgo.com/l/?rut=xyz")).toBe(null);
    expect(extractTargetUrl("not a url at all")).toBe(null);
    expect(extractTargetUrl("ftp://example.com/file")).toBe(null);
  });

  it("parses titles, urls and snippets in order", () => {
    const results = parseDuckDuckGoHtml(DDG_FIXTURE);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe("https://www.emergencyplumbingmanchester.co.uk/");
    expect(results[0].title).toBe("Emergency Plumbers Manchester | 24/7 Callout");
    expect(results[0].snippet).toContain("emergency plumbing");
    expect(results[0].source).toBe("duckduckgo");
    expect(results[1].url).toBe(
      "https://www.checkatrade.com/blog/plumbers/manchester/",
    );
  });

  it("returns nothing for markup it does not recognise", () => {
    expect(parseDuckDuckGoHtml("<html><body>No results</body></html>")).toEqual([]);
  });

  it("de-duplicates repeated destinations", () => {
    const results = parseDuckDuckGoHtml(DDG_FIXTURE + DDG_FIXTURE);
    expect(results).toHaveLength(2);
  });
});

/** Shape of a real Bing results page, trimmed to two results. */
const BING_FIXTURE = `
<ol id="b_results" class="">
  <li class="b_algo" data-id iid=SERP.5327>
    <h2 class=""><a target="_blank" href="https://www.bing.com/ck/a?!&amp;&amp;p=abc&amp;u=a1aHR0cHM6Ly9hY21lLXBsdW1iaW5nLmNvLnVrLw&amp;ntb=1">Acme Plumbing Manchester - 24/7 Emergency</a></h2>
    <div class="b_caption"><p class="b_lineclamp2">Emergency plumbers covering Manchester and Salford.</p></div>
  </li>
  <li class="b_algo" data-id iid=SERP.5328>
    <h2 class=""><a target="_blank" href="https://www.bing.com/ck/a?!&amp;&amp;p=def&amp;u=a1aHR0cHM6Ly93d3cuY2hlY2thdHJhZGUuY29tL3BsdW1iZXJzLw&amp;ntb=1">Compare Plumbers - Checkatrade</a></h2>
    <div class="b_caption"><p class="b_lineclamp2">Read reviews of plumbers near you.</p></div>
  </li>
</ol>
`;

describe("Bing parsing", () => {
  it("decodes the base64 redirect wrapper", () => {
    expect(
      extractBingTargetUrl(
        "https://www.bing.com/ck/a?!&&p=abc&u=a1aHR0cHM6Ly9hY21lLXBsdW1iaW5nLmNvLnVrLw&ntb=1",
      ),
    ).toBe("https://acme-plumbing.co.uk/");
  });

  it("accepts a direct link that is not a bing redirect", () => {
    expect(extractBingTargetUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("rejects links with no resolvable destination", () => {
    expect(extractBingTargetUrl("https://www.bing.com/ck/a?u=zzz!!!")).toBe(null);
    expect(extractBingTargetUrl("javascript:void(0)")).toBe(null);
  });

  it("parses titles, urls and snippets", () => {
    const results = parseBingHtml(BING_FIXTURE);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      url: "https://acme-plumbing.co.uk/",
      title: "Acme Plumbing Manchester - 24/7 Emergency",
      source: "bing",
    });
    expect(results[0].snippet).toContain("Manchester");
    expect(results[1].url).toBe("https://www.checkatrade.com/plumbers/");
  });

  it("returns nothing for markup it does not recognise", () => {
    expect(parseBingHtml("<html><body>No results</body></html>")).toEqual([]);
  });

  it("detects the bot challenge page", () => {
    expect(isChallengePageFn("<title>Captcha</title>")).toBe(true);
    expect(isChallengePageFn("<p>unusual traffic from your network</p>")).toBe(true);
    expect(isChallengePageFn(BING_FIXTURE)).toBe(false);
  });
});

/** DuckDuckGo markup for an insurance search, used by the campaign preset test. */
const DDG_INSURANCE_FIXTURE = `
<div class="result results_links">
  <h2 class="result__title">
    <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.smithinsuranceagency.com%2F&amp;rut=abc">
      Smith Insurance Agency - Home &amp; Auto
    </a>
  </h2>
  <a class="result__snippet" href="#">Independent insurance agency serving families.</a>
</div>
`;

describe("search providers", () => {
  it("DuckDuckGo is always available, Brave needs a key", () => {
    expect(new DuckDuckGoProvider().available()).toBe(true);
    expect(new BraveSearchProvider().available()).toBe(false);
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    expect(new BraveSearchProvider().available()).toBe(true);
  });

  it("DuckDuckGo calls the html endpoint and parses the response", async () => {
    const fetchImpl = htmlFetch(DDG_FIXTURE);
    const results = await new DuckDuckGoProvider().search("plumber manchester", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toContain("html.duckduckgo.com/html/");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("q=plumber+manchester");
    expect(results).toHaveLength(2);
  });

  it("surfaces a non-200 response as an error rather than empty success", async () => {
    const fetchImpl = htmlFetch("", 429);
    await expect(
      new DuckDuckGoProvider().search("x", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/429/);
  });

  it("Brave sends the subscription token and maps results", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          web: {
            results: [
              { url: "https://acme-plumbing.co.uk/", title: "Acme", description: "We fix pipes" },
              { url: "not-a-url", title: "junk" },
            ],
          },
        }),
      ),
    );

    const results = await new BraveSearchProvider().search("plumber", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Subscription-Token"]).toBe("test-key");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ url: "https://acme-plumbing.co.uk/", title: "Acme" });
  });
});

describe("query building", () => {
  it("quotes a known business name", () => {
    expect(buildQueries({ name: "Northwind Logistics" })).toEqual([
      '"Northwind Logistics"',
      '"Northwind Logistics" official website',
    ]);
  });

  it("adds a natural trade + place phrasing", () => {
    const queries = buildQueries({
      niche: "emergency plumbing",
      location: "Manchester",
    });
    expect(queries).toEqual([
      "emergency plumbing Manchester",
      "emergency plumbing in Manchester",
    ]);
  });

  it("returns nothing when there is nothing to search", () => {
    expect(buildQueries({})).toEqual([]);
    expect(buildQueries({ name: "   " })).toEqual([]);
  });

  it("de-duplicates and caps at three queries", () => {
    const queries = buildQueries({
      name: "Acme",
      niche: "plumbing",
      category: "plumbing",
      location: "Leeds",
      keywords: ["24 hour", "callout", "emergency", "boiler"],
    });
    expect(queries.length).toBeLessThanOrEqual(3);
    expect(new Set(queries).size).toBe(queries.length);
  });

  it("knows whether there is anything searchable", () => {
    expect(hasSearchableInput(undefined)).toBe(false);
    expect(hasSearchableInput({})).toBe(false);
    expect(hasSearchableInput({ name: " ", keywords: ["", "  "] })).toBe(false);
    expect(hasSearchableInput({ location: "Leeds" })).toBe(true);
    expect(hasSearchableInput({ keywords: ["24 hour"] })).toBe(true);
  });

  it("describes the search for the UI", () => {
    expect(describeSearch(undefined)).toBe("Nothing to search yet");
    expect(describeSearch({ niche: "plumbing", location: "Manchester" })).toBe(
      "plumbing · Manchester",
    );
  });
});

describe("candidate classification", () => {
  it("reduces hosts to their registrable domain", () => {
    expect(registrableDomain("https://www.emergencyplumbingmanchester.co.uk/a/b")).toBe(
      "emergencyplumbingmanchester.co.uk",
    );
    expect(registrableDomain("https://shop.example.com")).toBe("example.com");
    expect(registrableDomain("not a url")).toBe("");
  });

  it("labels directories, social, reference and news hosts", () => {
    expect(classifyResult("https://www.checkatrade.com/x")).toBe("directory");
    expect(classifyResult("https://www.yell.com/x")).toBe("directory");
    expect(classifyResult("https://www.facebook.com/x")).toBe("social");
    expect(classifyResult("https://en.wikipedia.org/x")).toBe("reference");
    expect(classifyResult("https://www.bbc.co.uk/news")).toBe("news");
    expect(classifyResult("https://acme-plumbing.co.uk")).toBe("business-site");
  });

  it("treats only business sites as leads by default", () => {
    expect(isBusinessLike("https://acme-plumbing.co.uk")).toBe(true);
    expect(isBusinessLike("https://www.checkatrade.com/x")).toBe(false);
  });

  it("keeps one candidate per domain, ordered by score", () => {
    const results: SearchResult[] = [
      { title: "Acme Plumbing Manchester", url: "https://acme-plumbing.co.uk/", snippet: "", source: "test" },
      { title: "Other", url: "https://acme-plumbing.co.uk/about", snippet: "", source: "test" },
      { title: "Trader Plumbing Manchester", url: "https://trader123.com/", snippet: "Plumbing services", source: "test" },
      { title: "Listings", url: "https://www.checkatrade.com/plumbers", snippet: "", source: "test" },
    ];

    const ranked = rankCandidates(results, {
      niche: "plumbing",
      location: "Manchester",
    });

    expect(ranked.map((candidate) => candidate.domain)).toEqual([
      "acme-plumbing.co.uk",
      "trader123.com",
    ]);
    expect(ranked[0].url).toBe("https://acme-plumbing.co.uk/");
    expect(ranked.every((candidate) => candidate.kind === "business-site")).toBe(true);
  });

  it("drops results that do not mention what was asked for", () => {
    const descriptor = { niche: "emergency plumbing", location: "Manchester" };
    const results: SearchResult[] = [
      // Right trade, right place.
      { title: "Manchester Emergency Plumbers", url: "https://manchesterplumbing247.co.uk/", snippet: "24/7 callouts", source: "test" },
      // Matches the trade but not the place - rejected under "all" matching.
      { title: "BSK Plumbers", url: "https://bskplumbers.co.uk/", snippet: "Emergency plumber in Swindon", source: "test" },
      // The engine degraded and answered a single generic word.
      { title: "EMERGENCY Definition & Meaning", url: "https://www.merriam-webster.com/dictionary/emergency", snippet: "the state of being urgent", source: "test" },
      { title: "Emergency! (TV Series)", url: "https://www.imdb.com/title/tt0068067/", snippet: "1972 TV series", source: "test" },
    ];

    const domains = rankCandidates(results, descriptor).map((c) => c.domain);

    expect(domains).toContain("manchesterplumbing247.co.uk");
    expect(domains).not.toContain("bskplumbers.co.uk");
    expect(domains).not.toContain("merriam-webster.com");
    expect(domains).not.toContain("imdb.com");
  });

  it("requires every supplied dimension to match", () => {
    const results: SearchResult[] = [
      { title: "Acme Plumbers", url: "https://acmeplumbers.co.uk/", snippet: "Plumbers in Leeds", source: "test" },
      { title: "Acme Plumbers", url: "https://acmeplumbers-mcr.co.uk/", snippet: "Plumbers in Manchester", source: "test" },
    ];

    const all = rankCandidates(results, { niche: "plumbing", location: "Manchester" });
    expect(all.map((c) => c.domain)).toEqual(["acmeplumbers-mcr.co.uk"]);

    // "any" keeps the loosely-matching one as well.
    const any = rankCandidates(results, { niche: "plumbing", location: "Manchester" }, { relevance: "any" });
    expect(any.map((c) => c.domain)).toHaveLength(2);
  });

  it("ignores dimensions the operator left blank", () => {
    // No location was given, so the missing place cannot reject this result.
    const ranked = rankCandidates(
      [{ title: "Wright & Sons", url: "https://wrightandsons.co.uk/", snippet: "Family firm", source: "test" }],
      { name: "Wright & Sons" },
    );
    expect(ranked).toHaveLength(1);
  });

  it("can include directories when explicitly asked", () => {
    const ranked = rankCandidates(
      [{ title: "Listings", url: "https://www.checkatrade.com/plumbers", snippet: "", source: "test" }],
      { niche: "plumbing" },
      { includeDirectories: true },
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].kind).toBe("directory");
  });
});

describe("discoverBusinessUrls", () => {
  it("refuses to search with no description", async () => {
    const outcome = await discoverBusinessUrls({});
    expect(outcome.urls).toEqual([]);
    expect(outcome.error).toMatch(/Enter a business name/i);
  });

  it("reports failure instead of inventing results", async () => {
    vi.stubGlobal(
      "fetch",
      htmlFetch("", 503),
    );
    const outcome = await discoverBusinessUrls({ niche: "plumbing" });
    expect(outcome.urls).toEqual([]);
    expect(outcome.error).toMatch(/Search failed/i);
  });

  it("returns ranked business websites from real results", async () => {
    vi.stubGlobal(
      "fetch",
      htmlFetch(DDG_FIXTURE),
    );

    const outcome = await discoverBusinessUrls(
      { niche: "emergency plumbing", location: "Manchester" },
      { maxUrls: 10 },
    );

    // The fixture is DuckDuckGo markup, so Bing yields nothing and the run
    // fails over to DuckDuckGo.
    expect(outcome.provider).toBe("duckduckgo");
    expect(outcome.queries.length).toBeGreaterThan(0);
    expect(outcome.results.length).toBeGreaterThanOrEqual(2);
    // The directory is dropped; only the real business site survives.
    expect(outcome.urls).toEqual(["https://www.emergencyplumbingmanchester.co.uk/"]);
    expect(outcome.candidates[0].domain).toBe("emergencyplumbingmanchester.co.uk");
  });

  it("reports when only directories matched", async () => {
    vi.stubGlobal(
      "fetch",
      htmlFetch(`<a class="result__a" href="https://www.checkatrade.com/x">Listings</a>`),
    );
    const outcome = await discoverBusinessUrls({ niche: "plumbing" });
    expect(outcome.urls).toEqual([]);
    expect(outcome.error).toMatch(/none of them matched/i);
  });

  it("exposes which provider is in use", () => {
    expect(providerStatus().provider).toBe("duckduckgo");
    expect(providerStatus().note).toMatch(/bing/i);
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    expect(providerStatus().provider).toBe("brave");
  });

  it("fails over to the next provider when one is blocked", async () => {
    // Bing answers with a challenge; DuckDuckGo returns the real results.
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("bing.com")) {
        return Promise.resolve(new Response("<title>Captcha</title>", { status: 200 }));
      }
      return Promise.resolve(new Response(DDG_FIXTURE, { status: 200 }));
    });

    const outcome = await discoverBusinessUrls(
      { niche: "plumbing" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(outcome.provider).toBe("duckduckgo");
    expect(outcome.urls).toEqual(["https://www.emergencyplumbingmanchester.co.uk/"]);
  });

  it("reports a bot challenge instead of pretending nothing exists", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response("<div class='anomaly-modal'>Bot check</div>")),
      );

    const outcome = await discoverBusinessUrls(
      { niche: "plumbing" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(outcome.urls).toEqual([]);
    expect(outcome.error).toMatch(/challenge|rate-limit/i);
  });
});

describe("job target resolution", () => {
  const baseDraft: JobDraft = {
    name: "Test job",
    targetType: "domain",
    urlLimit: 100,
    sources: { websites: true, search: false, directories: false, social: false },
    configuration: { workers: 4, requestsPerSecond: 2, retries: 2, javascriptRendering: false },
  };

  it("splits and de-duplicates a pasted URL list", () => {
    expect(
      splitUrlList("https://a.com\nhttps://b.com\n  \nhttps://a.com\nhttps://c.com"),
    ).toEqual(["https://a.com", "https://b.com", "https://c.com"]);
  });

  it("turns a bare domain into a crawlable root URL", () => {
    expect(domainToUrl("example.com")).toBe("https://example.com/");
    expect(domainToUrl("https://www.example.com/about")).toBe("https://www.example.com/");
    expect(domainToUrl("")).toBe(null);
    expect(domainToUrl("ftp://example.com")).toBe(null);
  });

  it("seeds a domain job with exactly one URL", async () => {
    const resolved = await resolveJobTarget({ ...baseDraft, target: "Example.com" });
    expect(resolved.queueUrls).toEqual(["https://example.com/"]);
    expect(resolved.targetLabel).toBe("Example.com");
  });

  it("seeds a url-list job with every supplied URL", async () => {
    const resolved = await resolveJobTarget({
      ...baseDraft,
      targetType: "url-list",
      target: "https://a.com\nhttps://b.com",
    });
    expect(resolved.queueUrls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("reports an empty queue rather than silently creating a job with nothing", async () => {
    const resolved = await resolveJobTarget({
      ...baseDraft,
      targetType: "url-list",
      target: "   ",
    });
    expect(resolved.queueUrls).toEqual([]);
    expect(resolved.error).toBeTruthy();
  });

  it("uses the operator's picked search results without searching again", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);

    const resolved = await resolveJobTarget({
      ...baseDraft,
      targetType: "search",
      descriptor: { niche: "plumbing", location: "Manchester" },
      discoveredUrls: ["https://acme-plumbing.co.uk", "https://acme-plumbing.co.uk"],
    });

    expect(network).not.toHaveBeenCalled();
    expect(resolved.queueUrls).toEqual(["https://acme-plumbing.co.uk"]);
    expect(resolved.queries.length).toBeGreaterThan(0);
  });

  it("labels a search job with what was searched for", () => {
    expect(
      targetLabelFor(
        {
          ...baseDraft,
          targetType: "search",
          descriptor: { niche: "plumbing", location: "Manchester" },
        },
        [],
      ),
    ).toBe("Search: plumbing · Manchester");
  });

  it("resolves campaign presets to a real search", async () => {
    vi.stubGlobal(
      "fetch",
      htmlFetch(DDG_INSURANCE_FIXTURE),
    );

    const resolved = await resolveJobTarget({
      ...baseDraft,
      targetType: "campaign",
      campaignId: "insurance",
    });

    expect(resolved.targetLabel).toBe("Insurance Agencies");
    expect(resolved.queries.join(" ")).toMatch(/insurance/i);
    expect(resolved.queueUrls).toEqual(["https://www.smithinsuranceagency.com/"]);
  });
});

describe("listicle and comparison pages are classified as directories", () => {
  it("detects counted and comparison titles", () => {
    for (const [url, title] of [
      ["https://alldentists.co.uk/dentists/bristol", "140 Dentists in Bristol - Compare Prices & Reviews"],
      ["https://www.whatclinic.com/dentists/uk/bristol", "Top 10+ Dentists in Bristol • Check Prices & Reviews"],
      ["https://example.com/plumbers", "10 Best Plumbers in Leeds"],
      ["https://example.com/list", "List of Accounting Firms in Leeds"],
    ]) {
      expect(classifyResult(url, title)).toBe("directory");
    }
  });

  it("does not mistake a real business title for a listicle", () => {
    for (const [url, title] of [
      ["https://bristoldent.co.uk", "BristolDent Harbourside | Private Dental Clinic in Bristol"],
      ["https://oldlanddental.co.uk", "Oldland Dental Practice In Bristol | Bristol Dentist"],
      ["https://www.247plumbers.example.com", "24/7 Emergency Plumber Manchester"],
    ]) {
      expect(classifyResult(url, title)).toBe("business-site");
    }
  });
});

describe("counted listing pages mid-title", () => {
  it("detects '156 dental practices' style counts", () => {
    expect(
      classifyResult(
        "https://dentistlocator.co.uk/bristol",
        "Dentists in Bristol: 156 dental practices | Dentist Locator",
      ),
    ).toBe("directory");
  });

  it("keeps real businesses that merely contain numbers", () => {
    expect(classifyResult("https://example.com", "24/7 Emergency Plumber Manchester")).toBe("business-site");
    expect(classifyResult("https://example.com", "Smith & Co - 20 years of local service")).toBe("business-site");
  });
});
