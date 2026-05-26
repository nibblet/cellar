import type { BadgeComputeInput } from "./compute";
import { countTotalsForMember } from "./compute";
import {
  badgeForCount,
  COUNT_BADGE_TRACK_ORDER,
  remainingToNextMilestone,
  type CountBadgeTrack,
} from "./count-milestones";
import type { MemberBadge } from "./definitions";

export type NextBadge = {
  badge: MemberBadge;
  gap: string;
};

const TRACK_GAP: Record<CountBadgeTrack, string> = {
  light: "1 recommend",
  smoke: "1 cigar",
  pour: "1 bourbon",
  contribution: "10 tastings",
};

const TRACK_COUNT_KEY = {
  light: "recommends",
  smoke: "cigars",
  pour: "bourbons",
  contribution: "total",
} as const;

export function nextBadgeForMember(input: BadgeComputeInput, memberId: string): NextBadge | null {
  const totals = countTotalsForMember(input.tastings, memberId);

  const candidates: NextBadge[] = [];

  for (const track of COUNT_BADGE_TRACK_ORDER) {
    const count = totals[TRACK_COUNT_KEY[track]];
    const currentBadge = badgeForCount(track, count);

    if (currentBadge) {
      const remaining = remainingToNextMilestone(count);
      const nextBadge = badgeForCount(track, nextMilestoneTargetCount(count));
      if (nextBadge && remaining > 0) {
        candidates.push({
          badge: nextBadge,
          gap: `${remaining} to go`,
        });
      }
      continue;
    }

    if (track === "contribution") {
      candidates.push({
        badge: badgeForCount(track, 10)!,
        gap: `${10 - count} to go`,
      });
    } else if (count === 0) {
      candidates.push({
        badge: badgeForCount(track, 1)!,
        gap: TRACK_GAP[track],
      });
    }
  }

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const ga = numericGap(a.gap);
    const gb = numericGap(b.gap);
    if (ga !== gb) return ga - gb;
    return COUNT_BADGE_TRACK_ORDER.indexOf(trackForBadge(a.badge)) -
      COUNT_BADGE_TRACK_ORDER.indexOf(trackForBadge(b.badge));
  })[0];
}

function nextMilestoneTargetCount(count: number): number {
  if (count < 10) return 10;
  return (Math.floor(count / 10) + 1) * 10;
}

function trackForBadge(badge: MemberBadge): CountBadgeTrack {
  const match = badge.id.match(/^count:(\w+):/);
  return (match?.[1] ?? "contribution") as CountBadgeTrack;
}

function numericGap(gap: string): number {
  const match = gap.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}
