import { describe, expect, it } from "vitest";
import { filterPickerProducts } from "./picker-products";

describe("filterPickerProducts", () => {
  const products = [
    { id: "1", name: "Padron 1964", brand: "Padron" },
    { id: "2", name: "Blanton's", brand: "Buffalo Trace" },
  ];

  it("returns all when query empty", () => {
    expect(filterPickerProducts(products, "")).toHaveLength(2);
  });

  it("matches name or brand case-insensitively", () => {
    expect(filterPickerProducts(products, "padron").map((p) => p.id)).toEqual(["1"]);
    expect(filterPickerProducts(products, "buffalo").map((p) => p.id)).toEqual(["2"]);
  });
});
