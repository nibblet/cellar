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

describe("computeMemberBadges", () => {
  it("awards club-first milestones to the earliest taster", () => {
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

    expect(map.get("bob")).toContain("first-light");
    expect(map.get("carl")).toContain("first-smoke");
    expect(map.get("alice")).toContain("first-pour");
    expect(map.get("bob")).not.toContain("first-smoke");
  });

  it("marks founders within thirty days of the earliest join date", () => {
    const map = computeMemberBadges(baseInput());
    expect(map.get("alice")).toContain("founder");
    expect(map.get("bob")).toContain("founder");
    expect(map.get("carl") ?? []).not.toContain("founder");
  });

  it("awards host to members who hosted a meetup", () => {
    const map = computeMemberBadges(
      baseInput({
        events: [{ id: "e1", date: "2026-03-01", host_user_id: "bob" }],
      }),
    );
    expect(map.get("bob")).toContain("host");
  });

  it("awards tenth contribution at ten tastings", () => {
    const tastings = Array.from({ length: 10 }, (_, i) => ({
      user_id: "alice",
      product_id: `p${i}`,
      product_type: "cigar" as const,
      recommend: false,
      created_at: `2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      event_id: null,
    }));

    const map = computeMemberBadges(baseInput({ tastings }));
    expect(map.get("alice")).toContain("tenth-contribution");
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

    expect(map.get("bob")).toContain("validator");
    expect(map.get("carl") ?? []).not.toContain("validator");
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

    expect(map.get("alice")).toContain("winstons-choice");
  });
});
