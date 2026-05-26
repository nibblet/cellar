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
  it("returns first-light for a member with zero recommends", () => {
    const next = nextBadgeForMember(input(), "alice");
    expect(next?.badge.id).toBe("count:light:first");
    expect(next?.gap).toBe("1 recommend");
  });

  it("returns the closest milestone gap across tracks", () => {
    const tastings = Array.from({ length: 4 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: (i === 0 ? "cigar" : "bourbon") as "cigar" | "bourbon",
      recommend: true,
      created_at: `2026-03-0${i + 1}T00:00:00Z`,
      event_id: null,
    }));
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(next?.badge.id).toBe("count:light:10");
    expect(next?.gap).toBe("6 to go");
  });

  it("prioritizes unstarted tracks over in-progress milestones", () => {
    const tastings = Array.from({ length: 7 }, (_, i) => ({
      user_id: "alice",
      product_id: `c${i}`,
      product_type: "cigar" as const,
      recommend: false,
      created_at: `2026-03-0${i + 1}T00:00:00Z`,
      event_id: null,
    }));
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(next?.badge.id).toBe("count:light:first");
    expect(next?.gap).toBe("1 recommend");
  });

  it("shows the next decade milestone when a track is already at ten", () => {
    const tastings = Array.from({ length: 10 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: (i % 2 === 0 ? "bourbon" : "cigar") as "bourbon" | "cigar",
      recommend: true,
      created_at: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      event_id: null,
    }));
    const next = nextBadgeForMember(input({ tastings }), "alice");
    expect(next?.badge.id).toBe("count:smoke:10");
    expect(next?.gap).toBe("5 to go");
  });
});
