import { describe, expect, it } from "vitest";
import { makerSlug } from "./slug";

describe("makerSlug", () => {
  it("lowercases and hyphenates brand names", () => {
    expect(makerSlug("Oliva Cigar")).toBe("oliva-cigar");
  });

  it("strips leading and trailing punctuation", () => {
    expect(makerSlug("  Padrón & Co.  ")).toBe("padr-n-co");
  });
});
