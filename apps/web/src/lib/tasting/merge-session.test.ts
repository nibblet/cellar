import { describe, expect, it } from "vitest";
import {
  formatSessionNote,
  mergeBourbonSession,
  mergeCigarSession,
  mergeSessionChips,
} from "./merge-session";

describe("mergeSessionChips", () => {
  it("dedupes chips case-insensitively across phases", () => {
    const chips = mergeSessionChips([
      { chips: ["Cocoa", "Leather"], note: "" },
      { chips: ["cocoa", "Pepper"], note: "" },
      { chips: ["Coffee"], note: "" },
    ]);
    expect(chips).toEqual(["Cocoa", "Leather", "Pepper", "Coffee"]);
  });

  it("skips empty strings", () => {
    expect(mergeSessionChips([{ chips: ["  ", ""], note: "" }])).toEqual([]);
  });
});

describe("formatSessionNote", () => {
  it("joins labeled phase notes with newlines", () => {
    const note = formatSessionNote([
      { label: "First third", note: "cocoa, leather" },
      { label: "Second third", note: "pepper builds" },
      { label: "Final third", note: "" },
    ]);
    expect(note).toBe("First third: cocoa, leather\nSecond third: pepper builds");
  });

  it("returns null when all notes are empty", () => {
    expect(formatSessionNote([{ label: "Nose", note: "   " }])).toBeNull();
  });
});

describe("mergeCigarSession", () => {
  it("merges all phases into flat chips and labeled note", () => {
    const result = mergeCigarSession({
      first: { chips: ["Cocoa"], note: "smooth open" },
      second: { chips: ["Pepper"], note: "" },
      final: { chips: ["Coffee"], note: "long finish" },
    });
    expect(result.chips).toEqual(["Cocoa", "Pepper", "Coffee"]);
    expect(result.note).toBe("First third: smooth open\nFinal third: long finish");
  });
});

describe("mergeBourbonSession", () => {
  it("merges nose / palate / finish", () => {
    const result = mergeBourbonSession({
      nose: { chips: ["Vanilla"], note: "sweet" },
      palate: { chips: ["Oak"], note: "" },
      finish: { chips: ["Rye"], note: "warm" },
    });
    expect(result.chips).toEqual(["Vanilla", "Oak", "Rye"]);
    expect(result.note).toBe("Nose: sweet\nFinish: warm");
  });
});
