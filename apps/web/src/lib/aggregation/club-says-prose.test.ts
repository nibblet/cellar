import { describe, expect, it } from "vitest";
import { buildClubSaysProse } from "./club-says-prose";
import type { GroupVoice, MemberTake } from "./group-voice";

function voice(overrides: Partial<GroupVoice> = {}): GroupVoice {
  return {
    member_count: 0,
    recommend_count: 0,
    takes: [],
    tag_cloud: [],
    ...overrides,
  };
}

describe("buildClubSaysProse", () => {
  it("returns empty-state copy when no tastings", () => {
    expect(buildClubSaysProse(voice(), undefined)).toBe(
      "No one's weighed in yet, sir. Be the first.",
    );
  });

  it("names a single recommender and top tastes", () => {
    const prose = buildClubSaysProse(
      voice({
        member_count: 1,
        recommend_count: 1,
        takes: [
          {
            user_id: "1",
            display_name: "Paul C",
            recommend: true,
            chips: [],
            note: null,
            release_label: null,
            created_at: "",
          },
        ],
        tag_cloud: [
          {
            leaf_id: "leather",
            label: "leather",
            category_id: "earth",
            category_label: "Earth",
            score: 1,
            raw: 1,
            mentions: 1,
          },
          {
            leaf_id: "hay",
            label: "hay",
            category_id: "earth",
            category_label: "Earth",
            score: 0.8,
            raw: 0.8,
            mentions: 1,
          },
        ],
      }),
      undefined,
    );
    expect(prose).toContain("Paul C recommends it");
    expect(prose).toContain("leather");
  });

  it("notes when viewer chips overlap club tags", () => {
    const myTake: MemberTake = {
      user_id: "me",
      display_name: "Paul S",
      recommend: true,
      chips: ["Leather", "Easy draw"],
      note: null,
      release_label: null,
      created_at: "",
    };
    const prose = buildClubSaysProse(
      voice({
        member_count: 1,
        recommend_count: 1,
        takes: [myTake],
        tag_cloud: [
          {
            leaf_id: "leather",
            label: "leather",
            category_id: "earth",
            category_label: "Earth",
            score: 1,
            raw: 1,
            mentions: 1,
          },
        ],
      }),
      myTake,
    );
    expect(prose?.toLowerCase()).toContain("your notes match");
  });
});
