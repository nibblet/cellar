import { describe, expect, it } from "vitest";
import { isCatalogSearchReady, sanitizeCatalogQuery } from "./search";

describe("sanitizeCatalogQuery", () => {
  it("strips unsafe characters and collapses whitespace", () => {
    expect(sanitizeCatalogQuery("  lucky   seven!  ")).toBe("lucky seven");
  });

  it("preserves name-friendly punctuation", () => {
    expect(sanitizeCatalogQuery("Blanton's")).toBe("Blanton's");
  });
});

describe("isCatalogSearchReady", () => {
  it("requires at least two sanitized characters", () => {
    expect(isCatalogSearchReady("k")).toBe(false);
    expect(isCatalogSearchReady("kr")).toBe(true);
    expect(isCatalogSearchReady("  l  ")).toBe(false);
    expect(isCatalogSearchReady("lucky")).toBe(true);
  });
});
