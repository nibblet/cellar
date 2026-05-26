import { describe, expect, it } from "vitest";
import { type BadgeComputeInput, computeMemberBadges } from "./compute";

const members = [
  { id: "alice", joined_at: "2026-01-01T00:00:00Z" },
  { id: "bob", joined_at: "2026-01-15T00:00:00Z" },
  { id: "carl", joined_at: "2026-02-15T00:00:00Z" },
];

function baseInput(overrides: Partial<BadgeComputeInput> = {}): BadgeComputeInput {
  return {
    members,
    tastings: [],
    events: [],
    winstonPairs: [],
    ...overrides,
  };
}

function badgeIds(map: ReturnType<typeof computeMemberBadges>, memberId: string): string[] {
  return (map.get(memberId) ?? []).map((b) => b.id);
}

describe("computeMemberBadges", () => {
  it("awards personal first milestones to each member", () => {
    const map = computeMemberBadges(
      baseInput({
        tastings: [
          {
            user_id: "bob",
            product_id: "c1",
            product_type: "cigar",
            recommend: true,
            created_at: "2026-03-01T00:00:00Z",
            event_id: null,
          },
          {
            user_id: "alice",
            product_id: "b1",
            product_type: "bourbon",
            recommend: false,
            created_at: "2026-02-01T00:00:00Z",
            event_id: null,
          },
          {
            user_id: "carl",
            product_id: "c2",
            product_type: "cigar",
            recommend: false,
            created_at: "2026-01-01T00:00:00Z",
            event_id: null,
          },
        ],
      }),
    );

    expect(badgeIds(map, "bob")).toContain("count:light:first");
    expect(badgeIds(map, "bob")).toContain("count:smoke:first");
    expect(badgeIds(map, "carl")).toContain("count:smoke:first");
    expect(badgeIds(map, "alice")).toContain("count:pour:first");
  });

  it("replaces first badges with tenth milestones and increments by ten", () => {
    const tenRecommends = Array.from({ length: 10 }, (_, i) => ({
      user_id: "alice",
      product_id: `c${i}`,
      product_type: "cigar" as const,
      recommend: true,
      created_at: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      event_id: null,
    }));

    const mapAtTen = computeMemberBadges(baseInput({ tastings: tenRecommends }));
    expect(badgeIds(mapAtTen, "alice")).toContain("count:light:10");
    expect(badgeIds(mapAtTen, "alice")).not.toContain("count:light:first");
    expect(badgeIds(mapAtTen, "alice")).toContain("count:smoke:10");

    const twentyCigars = Array.from({ length: 20 }, (_, i) => ({
      user_id: "alice",
      product_id: `c${i}`,
      product_type: "cigar" as const,
      recommend: false,
      created_at: `2026-03-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      event_id: null,
    }));

    const mapAtTwenty = computeMemberBadges(baseInput({ tastings: twentyCigars }));
    expect(badgeIds(mapAtTwenty, "alice")).toContain("count:smoke:20");
    expect(badgeIds(mapAtTwenty, "alice")).not.toContain("count:smoke:10");
  });

  it("marks founders within thirty days of the earliest join date", () => {
    const map = computeMemberBadges(baseInput());
    expect(badgeIds(map, "alice")).toContain("founder");
    expect(badgeIds(map, "bob")).toContain("founder");
    expect(badgeIds(map, "carl") ?? []).not.toContain("founder");
  });

  it("awards host to members who hosted a meetup", () => {
    const map = computeMemberBadges(
      baseInput({
        events: [{ id: "e1", date: "2026-03-01", host_user_id: "bob" }],
      }),
    );
    expect(badgeIds(map, "bob")).toContain("host");
  });

  it("awards contribution milestone at ten total tastings", () => {
    const tastings = Array.from({ length: 10 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: "cigar" as const,
      recommend: false,
      created_at: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      event_id: null,
    }));

    const map = computeMemberBadges(baseInput({ tastings }));
    expect(badgeIds(map, "alice")).toContain("count:contribution:10");
  });

  it("awards validator to the earliest meetup pairing witness", () => {
    const map = computeMemberBadges(
      baseInput({
        events: [
          { id: "e1", date: "2026-04-01", host_user_id: null },
          { id: "e2", date: "2026-05-01", host_user_id: null },
        ],
        tastings: [
          {
            user_id: "bob",
            product_id: "c1",
            product_type: "cigar",
            recommend: true,
            created_at: "2026-04-01T10:00:00Z",
            event_id: "e1",
          },
          {
            user_id: "bob",
            product_id: "b1",
            product_type: "bourbon",
            recommend: true,
            created_at: "2026-04-01T11:00:00Z",
            event_id: "e1",
          },
          {
            user_id: "carl",
            product_id: "c2",
            product_type: "cigar",
            recommend: true,
            created_at: "2026-05-01T10:00:00Z",
            event_id: "e2",
          },
          {
            user_id: "carl",
            product_id: "b2",
            product_type: "bourbon",
            recommend: true,
            created_at: "2026-05-01T11:00:00Z",
            event_id: "e2",
          },
        ],
      }),
    );

    expect(badgeIds(map, "bob")).toContain("validator");
    expect(badgeIds(map, "carl") ?? []).not.toContain("validator");
  });

  it("awards winstons choice when a recommend touches a narrated pairing", () => {
    const map = computeMemberBadges(
      baseInput({
        winstonPairs: [{ cigar_id: "c1", bourbon_id: "b1" }],
        tastings: [
          {
            user_id: "alice",
            product_id: "c1",
            product_type: "cigar",
            recommend: true,
            created_at: "2026-03-01T00:00:00Z",
            event_id: null,
          },
        ],
      }),
    );

    expect(badgeIds(map, "alice")).toContain("winstons-choice");
  });
});
