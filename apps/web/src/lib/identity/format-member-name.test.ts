import { describe, expect, it } from "vitest";
import { formatMemberInitials, formatMemberName } from "./format-member-name";

describe("formatMemberName", () => {
  it("returns first name + last initial", () => {
    expect(formatMemberName({ name_first: "Paul", name_last_initial: "C" })).toBe("Paul C");
  });

  it("handles the two-Paul case as distinct strings", () => {
    expect(formatMemberName({ name_first: "Paul", name_last_initial: "C" })).toBe("Paul C");
    expect(formatMemberName({ name_first: "Paul", name_last_initial: "B" })).toBe("Paul B");
  });

  it("uppercases the initial defensively", () => {
    expect(formatMemberName({ name_first: "Carl", name_last_initial: "b" })).toBe("Carl B");
  });

  it("trims whitespace", () => {
    expect(formatMemberName({ name_first: "  Mike  ", name_last_initial: " S " })).toBe("Mike S");
  });

  it("takes only the first character if a longer last name slips in", () => {
    expect(formatMemberName({ name_first: "Dave", name_last_initial: "Smith" })).toBe("Dave S");
  });

  it("falls back gracefully when first name missing", () => {
    expect(formatMemberName({ name_first: "", name_last_initial: "J" })).toBe("J");
  });

  it("falls back gracefully when initial missing", () => {
    expect(formatMemberName({ name_first: "John", name_last_initial: "" })).toBe("John");
  });

  it("falls back to 'Member' when both empty", () => {
    expect(formatMemberName({ name_first: "", name_last_initial: "" })).toBe("Member");
  });
});

describe("formatMemberInitials", () => {
  it("returns first + last initial", () => {
    expect(formatMemberInitials({ name_first: "Paul", name_last_initial: "C" })).toBe("PC");
  });

  it("uppercases and trims", () => {
    expect(formatMemberInitials({ name_first: "  carl  ", name_last_initial: " b " })).toBe("CB");
  });

  it("falls back when one field missing", () => {
    expect(formatMemberInitials({ name_first: "John", name_last_initial: "" })).toBe("J");
    expect(formatMemberInitials({ name_first: "", name_last_initial: "K" })).toBe("K");
  });

  it("falls back to ? when both empty", () => {
    expect(formatMemberInitials({ name_first: "", name_last_initial: "" })).toBe("?");
  });
});
