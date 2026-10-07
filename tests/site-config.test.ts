import { afterEach, describe, expect, it } from "vitest";
import { stripBasePath, withBasePath } from "../src/lib/site-config";

/**
 * When the app is mounted under a sub-path (BASE_PATH=/app) every hand-written
 * URL has to carry that prefix, and every incoming pathname has to have it
 * removed before route comparison. Those two helpers are the whole contract.
 */
const OLD_BASE_PATH = process.env.BASE_PATH;

afterEach(() => {
  if (OLD_BASE_PATH === undefined) delete process.env.BASE_PATH;
  else process.env.BASE_PATH = OLD_BASE_PATH;
});

describe("withBasePath", () => {
  it("is a no-op when there is no base path", () => {
    expect(withBasePath("/dashboard", "")).toBe("/dashboard");
  });

  it("prefixes an absolute path", () => {
    expect(withBasePath("/dashboard", "/app")).toBe("/app/dashboard");
  });

  it("does not double up when the prefix is already present", () => {
    expect(withBasePath("/app/dashboard", "/app")).toBe("/app/dashboard");
    expect(withBasePath("/app", "/app")).toBe("/app");
  });

  it("does not treat a similarly-named route as prefixed", () => {
    // "/application" merely starts with the same letters as "/app".
    expect(withBasePath("/application", "/app")).toBe("/app/application");
  });

  it("leaves relative paths alone", () => {
    expect(withBasePath("dashboard", "/app")).toBe("dashboard");
  });
});

describe("stripBasePath", () => {
  it("is a no-op when there is no base path", () => {
    expect(stripBasePath("/dashboard", "")).toBe("/dashboard");
  });

  it("removes the prefix", () => {
    expect(stripBasePath("/app/dashboard", "/app")).toBe("/dashboard");
  });

  it("maps the mount root back to /", () => {
    expect(stripBasePath("/app", "/app")).toBe("/");
  });

  it("leaves unrelated paths untouched", () => {
    expect(stripBasePath("/login", "/app")).toBe("/login");
  });
});
