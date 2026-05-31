import { describe, expect, it } from "vitest";
import { pairingIds, sortClubValidatedFirst } from "./rank";

describe("sortClubValidatedFirst", () => {
  it("promotes club-validated above higher-scoring theoretical matches", () => {
    const sorted = sortClubValidatedFirst([
      { id: "a", clubValidated: false, score: 90 },
      { id: "b", clubValidated: true, score: 70 },
      { id: "c", clubValidated: false, score: 85 },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by score within the same validation tier", () => {
    const sorted = sortClubValidatedFirst([
      { id: "a", clubValidated: false, score: 60 },
      { id: "b", clubValidated: false, score: 80 },
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("pairingIds", () => {
  it("maps cigar source to cigar_id first", () => {
    expect(pairingIds("cigar", "c1", "b1")).toEqual({ cigar_id: "c1", bourbon_id: "b1" });
  });

  it("maps bourbon source to bourbon_id second", () => {
    expect(pairingIds("bourbon", "b1", "c1")).toEqual({ cigar_id: "c1", bourbon_id: "b1" });
  });
});
