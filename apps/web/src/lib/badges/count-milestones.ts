import type { MemberBadge } from "./definitions";

export type CountBadgeTrack = "light" | "smoke" | "pour" | "contribution";

const TRACK_META: Record<
  CountBadgeTrack,
  { suffix: string; firstLabel: string; milestoneLabel: string; firstHint: string; milestoneHint: (n: number) => string }
> = {
  light: {
    suffix: "L",
    firstLabel: "First Light",
    milestoneLabel: "Light",
    firstHint: "First tasting recommended to NCCC",
    milestoneHint: (n) => `${n} tastings recommended to NCCC`,
  },
  smoke: {
    suffix: "S",
    firstLabel: "First Smoke",
    milestoneLabel: "Smoke",
    firstHint: "First cigar tasting logged",
    milestoneHint: (n) => `${n} cigar tastings logged`,
  },
  pour: {
    suffix: "P",
    firstLabel: "First Pour",
    milestoneLabel: "Pour",
    firstHint: "First bourbon tasting logged",
    milestoneHint: (n) => `${n} bourbon tastings logged`,
  },
  contribution: {
    suffix: "",
    firstLabel: "",
    milestoneLabel: "Contribution",
    firstHint: "",
    milestoneHint: (n) => `${n} tastings logged`,
  },
};

function ordinalWord(n: number): string {
  if (n === 10) return "Tenth";
  if (n === 20) return "Twentieth";
  if (n === 30) return "Thirtieth";
  if (n === 40) return "Fortieth";
  if (n === 50) return "Fiftieth";
  return `${n}th`;
}

export function countBadgeId(track: CountBadgeTrack, level: "first" | number): string {
  return level === "first" ? `count:${track}:first` : `count:${track}:${level}`;
}

export function badgeForCount(track: CountBadgeTrack, count: number): MemberBadge | null {
  if (count <= 0) return null;

  const meta = TRACK_META[track];

  if (count < 10) {
    if (track === "contribution") return null;
    return {
      id: countBadgeId(track, "first"),
      label: meta.firstLabel,
      mark: `1${meta.suffix}`,
      hint: meta.firstHint,
    };
  }

  const milestone = Math.floor(count / 10) * 10;
  return {
    id: countBadgeId(track, milestone),
    label: `${ordinalWord(milestone)} ${meta.milestoneLabel}`,
    mark: meta.suffix ? `${milestone}${meta.suffix}` : String(milestone),
    hint: meta.milestoneHint(milestone),
  };
}

export function nextMilestoneTarget(count: number): number {
  if (count < 10) return 10;
  return (Math.floor(count / 10) + 1) * 10;
}

export function remainingToNextMilestone(count: number): number {
  return nextMilestoneTarget(count) - count;
}

export const COUNT_BADGE_TRACK_ORDER: CountBadgeTrack[] = [
  "light",
  "smoke",
  "pour",
  "contribution",
];

export function countBadgeSortIndex(badgeId: string): number {
  const match = badgeId.match(/^count:(\w+):(first|\d+)$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const track = match[1] as CountBadgeTrack;
  const level = match[2];
  const trackIndex = COUNT_BADGE_TRACK_ORDER.indexOf(track);
  const levelIndex = level === "first" ? 0 : Number.parseInt(level, 10);
  return trackIndex * 1000 + levelIndex;
}
