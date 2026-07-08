import { describe, expect, it } from "vitest";
import { parseCatalogPage } from "./paginate";

describe("parseCatalogPage", () => {
  it("defaults to page 1 and size 36", () => {
    expect(parseCatalogPage({})).toEqual({ page: 1, pageSize: 36, offset: 0 });
  });

  it("computes offset from page number", () => {
    expect(parseCatalogPage({ page: "3" })).toEqual({ page: 3, pageSize: 36, offset: 72 });
  });

  it("falls back on invalid page", () => {
    expect(parseCatalogPage({ page: "abc" })).toEqual({ page: 1, pageSize: 36, offset: 0 });
  });
});
