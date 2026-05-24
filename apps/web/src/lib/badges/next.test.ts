import { describe, expect, it } from "vitest";
import type { BadgeComputeInput } from "./compute";
import { nextBadgeForMember } from "./next";

const members = [
  { id: "alice", joined_at: "2026-01-01T00:00:00Z" },
  { id: "bob", joined_at: "2026-01-15T00:00:00Z" },
];

function input(overrides: Partial<BadgeComputeInput> = {}): BadgeComputeInput {
  return { members, tastings: [], events: [], winstonPairs: [], ...overrides };
}

describe("nextBadgeForMember", () => {
  it("returns first-light for a member with zero tastings when no one has it", () => {
    const next = nextBadgeForMember(input(), "alice");
    expect(next?.badge.id).toBe("first-light");
    expect(next?.gap).toBe("1 tasting");
  });

  it("returns tenth-contribution gap based on remaining tastings", () => {
    const tastings = Array.from({ length: 4 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: (i === 0 ? "cigar" : "bourbon") as "cigar" | "bourbon",
      recommend: true,
      created_at: `2026-03-0${i + 1}T00:00:00Z`,
      event_id: null,
    }));
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(next?.badge.id).toBe("tenth-contribution");
    expect(next?.gap).toBe("6 to go");
  });

  it("skips first-light if another member already claimed it", () => {
    const tastings = [
      {
        user_id: "bob",
        product_id: "p1",
        product_type: "cigar" as const,
        recommend: true,
        created_at: "2026-02-01T00:00:00Z",
        event_id: null,
      },
    ];
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(["first-pour", "first-smoke"]).toContain(next?.badge.id);
  });

  it("returns null when nothing remains achievable", () => {
    const tastings = Array.from({ length: 10 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: (i % 2 === 0 ? "bourbon" : "cigar") as "bourbon" | "cigar",
      recommend: true,
      created_at: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      event_id: null,
    }));
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(next).toBeNull();
  });
});
