import { describe, expect, it } from "vitest";
import { type BourbonCsvRow, parseBourbonRow } from "./bourbon-parser";

const sampleRow: BourbonCsvRow = {
  Name: "Jack Daniel's Bonded, 50%",
  Price: "30",
  Abv: "50",
  Rating: "97",
  Year_Made: "2022",
  Distillery: "Jack Daniel Distillery",
  Mash_Bill: "80% corn, 12% malted barley, 8% rye",
  Flavor_Profile: "caramel, oak, vanilla, spice",
  "Aging Period": "4",
};

describe("parseBourbonRow", () => {
  it("extracts name and brand from a known sample", () => {
    const parsed = parseBourbonRow(sampleRow);
    expect(parsed?.name).toBe("Jack Daniel's Bonded, 50%");
    expect(parsed?.brand).toBe("Jack Daniel");
  });

  it("computes proof from ABV", () => {
    const parsed = parseBourbonRow(sampleRow);
    expect(parsed?.specs.abv).toBe(50);
    expect(parsed?.specs.proof).toBe(100);
  });

  it("preserves mash bill when disclosed", () => {
    const parsed = parseBourbonRow(sampleRow);
    expect(parsed?.specs.mash_bill).toBe("80% corn, 12% malted barley, 8% rye");
  });

  it("drops 'undisclosed' mash bill", () => {
    const parsed = parseBourbonRow({ ...sampleRow, Mash_Bill: "undisclosed" });
    expect(parsed?.specs.mash_bill).toBeUndefined();
  });

  it("maps Flavor_Profile descriptors onto wheel leaves at baseline 3/5", () => {
    const parsed = parseBourbonRow(sampleRow);
    expect(parsed?.wheel_vector.caramel).toBe(3);
    expect(parsed?.wheel_vector.oak).toBe(3);
    expect(parsed?.wheel_vector.vanilla).toBe(3);
  });

  it("captures unmapped descriptors for later review", () => {
    // 'spice' isn't a canonical bourbon wheel leaf (it's covered by black-pepper / cinnamon / etc.)
    const parsed = parseBourbonRow(sampleRow);
    expect(parsed?.unmapped_descriptors).toContain("spice");
  });

  it("strips parenthetical owners from distillery", () => {
    const parsed = parseBourbonRow({
      ...sampleRow,
      Distillery: "Old Forester Distillery (Brown-Forman)",
    });
    expect(parsed?.brand).toBe("Old Forester");
  });

  it("returns null for an unnamed row", () => {
    expect(parseBourbonRow({ ...sampleRow, Name: "" })).toBeNull();
  });

  it("handles missing optional fields gracefully", () => {
    const parsed = parseBourbonRow({
      ...sampleRow,
      Price: "",
      Year_Made: "",
      "Aging Period": "",
    });
    expect(parsed?.specs.price_usd).toBeUndefined();
    expect(parsed?.specs.year_made).toBeUndefined();
    expect(parsed?.specs.aging_period_years).toBeUndefined();
  });
});
