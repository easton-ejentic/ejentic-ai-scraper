import { describe, expect, it } from "vitest";
import { isHttpUrl, normalizeUrl, sameOrigin } from "@/lib/scraper/url";

describe("normalizeUrl", () => {
  it("adds a scheme when missing", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });

  it("lowercases the host but preserves the path case", () => {
    expect(normalizeUrl("https://Example.COM/About")).toBe("https://example.com/About");
  });

  it("strips the fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
  });

  it("removes a trailing slash from a non-root path", () => {
    expect(normalizeUrl("https://example.com/about/")).toBe("https://example.com/about");
  });

  it("keeps the root path as-is", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("rejects non-http protocols", () => {
    expect(normalizeUrl("ftp://example.com/file")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(normalizeUrl("not a url at all")).toBeNull();
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https", () => {
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("https://example.com")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("data:text/html,hi")).toBe(false);
    expect(isHttpUrl("nonsense")).toBe(false);
  });
});

describe("sameOrigin", () => {
  it("matches identical origins", () => {
    expect(sameOrigin("https://example.com/a", "https://example.com/b")).toBe(true);
  });

  it("distinguishes scheme, host and port", () => {
    expect(sameOrigin("http://example.com/a", "https://example.com/a")).toBe(false);
    expect(sameOrigin("https://example.com/a", "https://other.com/a")).toBe(false);
    expect(sameOrigin("https://example.com:8443/a", "https://example.com/a")).toBe(false);
  });
});
