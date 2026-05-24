import type { BadgeComputeInput } from "./compute";
import { computeMemberBadges } from "./compute";
import { MEMBER_BADGES, type MemberBadge, type MemberBadgeId } from "./definitions";

export type NextBadge = {
  badge: MemberBadge;
  gap: string;
};

const COUNT_DRIVEN: MemberBadgeId[] = [
  "first-light",
  "first-smoke",
  "first-pour",
  "tenth-contribution",
];

export function nextBadgeForMember(input: BadgeComputeInput, memberId: string): NextBadge | null {
  const earnedByMember = computeMemberBadges(input);
  const earned = new Set(earnedByMember.get(memberId) ?? []);

  const tastingCount = input.tastings.filter((t) => t.user_id === memberId).length;
  const hasBourbon = input.tastings.some(
    (t) => t.user_id === memberId && t.product_type === "bourbon",
  );
  const hasCigar = input.tastings.some((t) => t.user_id === memberId && t.product_type === "cigar");
  const hasRecommend = input.tastings.some((t) => t.user_id === memberId && t.recommend);

  const allEarned = new Set<MemberBadgeId>();
  for (const list of earnedByMember.values()) {
    for (const id of list) allEarned.add(id);
  }

  const candidates: NextBadge[] = [];

  if (!earned.has("first-light") && !allEarned.has("first-light") && !hasRecommend) {
    candidates.push({ badge: MEMBER_BADGES["first-light"], gap: "1 tasting" });
  }
  if (!earned.has("first-smoke") && !allEarned.has("first-smoke") && !hasCigar) {
    candidates.push({ badge: MEMBER_BADGES["first-smoke"], gap: "1 cigar" });
  }
  if (!earned.has("first-pour") && !allEarned.has("first-pour") && !hasBourbon) {
    candidates.push({ badge: MEMBER_BADGES["first-pour"], gap: "1 bourbon" });
  }
  if (!earned.has("tenth-contribution")) {
    const remaining = 10 - tastingCount;
    if (remaining > 0) {
      candidates.push({
        badge: MEMBER_BADGES["tenth-contribution"],
        gap: `${remaining} to go`,
      });
    }
  }

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const ga = numericGap(a.gap);
    const gb = numericGap(b.gap);
    if (ga !== gb) return ga - gb;
    return COUNT_DRIVEN.indexOf(a.badge.id) - COUNT_DRIVEN.indexOf(b.badge.id);
  })[0];
}

function numericGap(gap: string): number {
  const match = gap.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}
