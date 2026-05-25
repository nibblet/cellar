import { describe, expect, it } from "vitest";
import { cleanCatalogDisplayName } from "./catalog-name-cleanup";

describe("cleanCatalogDisplayName", () => {
  it("strips age and batch from Barrell import names", () => {
    const r = cleanCatalogDisplayName({
      id: "1",
      name: "Barrell Bourbon (Batch 004)",
      brand: "Barrell",
      specs: { year_made: 2015 },
    });
    expect(r.displayName).toBe("Barrell Bourbon");
    expect(r.releaseLabel).toBe("Batch 004");
    expect(r.releasePattern).toBe("batch");
  });

  it("prefixes brand when raw name is age-only fragment", () => {
    const r = cleanCatalogDisplayName({
      id: "2",
      name: "10 year old Straight",
      brand: "Eagle Rare",
      specs: { age_label: "10 yr" },
    });
    expect(r.displayName).toBe("Eagle Rare");
    expect(r.ageLabel).toBe("10 yr");
  });

  it("extracts vintage year to release_label", () => {
    const r = cleanCatalogDisplayName({
      id: "3",
      name: "Evan Williams Single Barrel 1998 Vintage",
      brand: "Heaven Hill",
      specs: null,
    });
    expect(r.displayName).toContain("Evan Williams Single Barrel");
    expect(r.releaseLabel).toBe("1998");
    expect(r.releasePattern).toBe("year");
  });

  it("cleans Jack Daniel's Old No. 7", () => {
    const r = cleanCatalogDisplayName({
      id: "4",
      name: "Old No. 7",
      brand: "Jack Daniel's",
      specs: null,
    });
    expect(r.displayName).toBe("Jack Daniel's Old No. 7");
  });
});
