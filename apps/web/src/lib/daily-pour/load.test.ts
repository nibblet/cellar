import { describe, expect, it } from "vitest";
import { compareCandidatesForSelection, type DailyPourCandidate } from "./load";
import { selectDailyPour } from "./select";

function candidate(
  overrides: Partial<DailyPourCandidate> & Pick<DailyPourCandidate, "cigar_id" | "bourbon_id">,
): DailyPourCandidate {
  return {
    cigar_id: overrides.cigar_id,
    cigar_name: overrides.cigar_name ?? "Cigar",
    cigar_brand: overrides.cigar_brand ?? null,
    bourbon_id: overrides.bourbon_id,
    bourbon_name: overrides.bourbon_name ?? "Bourbon",
    bourbon_brand: overrides.bourbon_brand ?? null,
    score: overrides.score ?? 80,
    rationale: overrides.rationale ?? null,
    club_validated: overrides.club_validated ?? false,
  };
}

describe("compareCandidatesForSelection", () => {
  it("orders by cigar_id then bourbon_id", () => {
    const pool = [
      candidate({ cigar_id: "b-cigar", bourbon_id: "b-bourbon" }),
      candidate({ cigar_id: "a-cigar", bourbon_id: "z-bourbon" }),
      candidate({ cigar_id: "a-cigar", bourbon_id: "a-bourbon" }),
    ];
    pool.sort(compareCandidatesForSelection);
    expect(pool.map((c) => `${c.cigar_id}|${c.bourbon_id}`)).toEqual([
      "a-cigar|a-bourbon",
      "a-cigar|z-bourbon",
      "b-cigar|b-bourbon",
    ]);
  });
});

describe("stable daily pick", () => {
  it("picks the same candidate when the pool is shuffled but ID-sorted", () => {
    const seed = { memberId: "member-1", date: "2026-05-23" };
    const items = [
      candidate({ cigar_id: "cigar-a", bourbon_id: "bourbon-1", score: 90 }),
      candidate({ cigar_id: "cigar-b", bourbon_id: "bourbon-2", score: 85 }),
      candidate({ cigar_id: "cigar-c", bourbon_id: "bourbon-3", score: 80 }),
    ];

    const shuffled = [items[2], items[0], items[1]];
    shuffled.sort(compareCandidatesForSelection);

    const fromOrdered = selectDailyPour(seed, items);
    const fromShuffled = selectDailyPour(seed, shuffled);

    expect(fromShuffled).toEqual(fromOrdered);
  });
});
