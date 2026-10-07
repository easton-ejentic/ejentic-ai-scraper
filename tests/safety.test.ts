import { describe, expect, it } from "vitest";
import {
  backoffDelay,
  isBlockedHostname,
  isPrivateIpv4,
  isPrivateIpv6,
  robotsAllows,
} from "@/lib/scraper/safety";

describe("private IPv4 detection", () => {
  it.each([
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["127.0.0.1", true],
    ["127.1.2.3", true],
    ["169.254.169.254", true], // cloud metadata endpoint
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["192.168.1.1", true],
    ["0.0.0.0", true],
  ])("blocks %s", (address, expected) => {
    expect(isPrivateIpv4(address)).toBe(expected);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "93.184.216.34"])(
    "allows %s",
    (address) => {
      expect(isPrivateIpv4(address)).toBe(false);
    },
  );

  it("rejects malformed octets rather than guessing", () => {
    expect(isPrivateIpv4("999.1.1.1")).toBe(false);
    expect(isPrivateIpv4("10.0.0")).toBe(false);
    expect(isPrivateIpv4("not-an-ip")).toBe(false);
  });
});

describe("private IPv6 detection", () => {
  it.each(["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1"])(
    "blocks %s",
    (address) => {
      expect(isPrivateIpv6(address)).toBe(true);
    },
  );

  it("evaluates IPv4-mapped addresses as IPv4", () => {
    expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIpv6("::ffff:8.8.8.8")).toBe(false);
  });

  it("allows public addresses", () => {
    expect(isPrivateIpv6("2606:4700:4700::1111")).toBe(false);
  });
});

describe("isBlockedHostname", () => {
  it.each([
    "localhost",
    "app.localhost",
    "printer.local",
    "metadata.google.internal",
    "127.0.0.1",
    "10.1.2.3",
    "192.168.0.10",
    "::1",
  ])("blocks %s", (hostname) => {
    expect(isBlockedHostname(hostname)).toBe(true);
  });

  it("allows ordinary public hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("www.northwind-logistics.co.uk")).toBe(false);
  });
});

describe("robotsAllows", () => {
  const agent = "EjenticAI-DiscoveryBot/0.4";

  it("allows everything when there is no applicable group", () => {
    expect(robotsAllows("", "https://example.com/anything", agent)).toBe(true);
  });

  it("honours a wildcard disallow", () => {
    const policy = "User-agent: *\nDisallow: /private";
    expect(robotsAllows(policy, "https://example.com/private/data", agent)).toBe(false);
    expect(robotsAllows(policy, "https://example.com/public", agent)).toBe(true);
  });

  it("lets a longer allow override a shorter disallow", () => {
    const policy = "User-agent: *\nDisallow: /private\nAllow: /private/public";
    expect(robotsAllows(policy, "https://example.com/private/public/page", agent)).toBe(true);
    expect(robotsAllows(policy, "https://example.com/private/secret", agent)).toBe(false);
  });

  it("ignores rules belonging to a different agent", () => {
    const policy = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /";
    expect(robotsAllows(policy, "https://example.com/page", agent)).toBe(true);
  });

  it("treats an empty disallow as no restriction", () => {
    expect(robotsAllows("User-agent: *\nDisallow:", "https://example.com/x", agent)).toBe(true);
  });
});

describe("backoffDelay", () => {
  it("grows exponentially and respects the ceiling", () => {
    expect(backoffDelay(1)).toBe(500);
    expect(backoffDelay(2)).toBe(1000);
    expect(backoffDelay(3)).toBe(2000);
    expect(backoffDelay(50)).toBe(30_000);
  });
});
