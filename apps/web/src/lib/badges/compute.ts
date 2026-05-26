import {
  badgeForCount,
  countBadgeSortIndex,
  type CountBadgeTrack,
  COUNT_BADGE_TRACK_ORDER,
} from "./count-milestones";
import {
  BADGE_DISPLAY_ORDER,
  MEMBER_BADGES,
  type MemberBadge,
  type MemberBadgeId,
} from "./definitions";

export type BadgeTastingRow = {
  user_id: string;
  product_id: string;
  product_type: "cigar" | "bourbon";
  recommend: boolean;
  created_at: string;
  event_id: string | null;
};

export type BadgeMemberRow = {
  id: string;
  joined_at: string;
};

export type BadgeEventRow = {
  id: string;
  date: string;
  host_user_id: string | null;
};

export type BadgeWinstonPair = {
  cigar_id: string;
  bourbon_id: string;
};

export type BadgeComputeInput = {
  members: BadgeMemberRow[];
  tastings: BadgeTastingRow[];
  events: BadgeEventRow[];
  winstonPairs: BadgeWinstonPair[];
};

const FOUNDER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function computeFounders(members: BadgeMemberRow[]): Set<string> {
  const founders = new Set<string>();
  if (members.length === 0) return founders;

  const launch = members.reduce(
    (min, m) => (m.joined_at < min ? m.joined_at : min),
    members[0].joined_at,
  );
  const cutoff = new Date(new Date(launch).getTime() + FOUNDER_WINDOW_MS).toISOString();

  for (const member of members) {
    if (member.joined_at <= cutoff) founders.add(member.id);
  }
  return founders;
}

function computeValidators(tastings: BadgeTastingRow[], events: BadgeEventRow[]): Set<string> {
  const validators = new Set<string>();
  const eventDates = new Map(events.map((e) => [e.id, e.date]));

  type EventKey = string;
  const cigarByEvent = new Map<EventKey, Map<string, string>>();
  const bourbonByEvent = new Map<EventKey, Map<string, string>>();

  for (const row of tastings) {
    if (!row.recommend || !row.event_id) continue;

    const bucket =
      row.product_type === "cigar"
        ? (cigarByEvent.get(row.event_id) ?? new Map<string, string>())
        : (bourbonByEvent.get(row.event_id) ?? new Map<string, string>());

    if (!bucket.has(row.user_id)) {
      bucket.set(row.user_id, row.created_at);
    }

    if (row.product_type === "cigar") cigarByEvent.set(row.event_id, bucket);
    else bourbonByEvent.set(row.event_id, bucket);
  }

  let earliest: { user_id: string; created_at: string; event_date: string } | null = null;

  for (const eventId of cigarByEvent.keys()) {
    const cigars = cigarByEvent.get(eventId);
    const bourbons = bourbonByEvent.get(eventId);
    if (!cigars || !bourbons) continue;

    const eventDate = eventDates.get(eventId) ?? "";

    for (const [userId, cigarAt] of cigars) {
      const bourbonAt = bourbons.get(userId);
      if (!bourbonAt) continue;

      const createdAt = cigarAt < bourbonAt ? cigarAt : bourbonAt;
      if (
        !earliest ||
        eventDate < earliest.event_date ||
        (eventDate === earliest.event_date && createdAt < earliest.created_at)
      ) {
        earliest = { user_id: userId, created_at: createdAt, event_date: eventDate };
      }
    }
  }

  if (earliest) validators.add(earliest.user_id);
  return validators;
}

function computeWinstonsChoice(
  tastings: BadgeTastingRow[],
  winstonPairs: BadgeWinstonPair[],
): Set<string> {
  const winners = new Set<string>();
  if (winstonPairs.length === 0) return winners;

  const narratedProducts = new Set<string>();
  for (const pair of winstonPairs) {
    narratedProducts.add(pair.cigar_id);
    narratedProducts.add(pair.bourbon_id);
  }

  for (const row of tastings) {
    if (!row.recommend || !narratedProducts.has(row.product_id)) continue;
    winners.add(row.user_id);
  }
  return winners;
}

export type MemberCountTotals = {
  recommends: number;
  cigars: number;
  bourbons: number;
  total: number;
};

export function countTotalsForMember(
  tastings: BadgeTastingRow[],
  memberId: string,
): MemberCountTotals {
  const memberRows = tastings.filter((t) => t.user_id === memberId);
  return {
    recommends: memberRows.filter((t) => t.recommend).length,
    cigars: memberRows.filter((t) => t.product_type === "cigar").length,
    bourbons: memberRows.filter((t) => t.product_type === "bourbon").length,
    total: memberRows.length,
  };
}

const TRACK_COUNT_KEY: Record<CountBadgeTrack, keyof MemberCountTotals> = {
  light: "recommends",
  smoke: "cigars",
  pour: "bourbons",
  contribution: "total",
};

function badgeSortKey(badge: MemberBadge): number {
  const staticIndex = BADGE_DISPLAY_ORDER.indexOf(badge.id as MemberBadgeId);
  if (staticIndex >= 0) return staticIndex;
  return 100 + countBadgeSortIndex(badge.id);
}

export function computeMemberBadges(input: BadgeComputeInput): Map<string, MemberBadge[]> {
  const byMember = new Map<string, MemberBadge[]>();
  const push = (memberId: string, badge: MemberBadge) => {
    const list = byMember.get(memberId) ?? [];
    if (!list.some((b) => b.id === badge.id)) list.push(badge);
    byMember.set(memberId, list);
  };

  const founders = computeFounders(input.members);
  const validators = computeValidators(input.tastings, input.events);
  const winstonsChoice = computeWinstonsChoice(input.tastings, input.winstonPairs);

  const hosts = new Set(
    input.events.map((e) => e.host_user_id).filter((id): id is string => Boolean(id)),
  );

  for (const member of input.members) {
    if (founders.has(member.id)) push(member.id, MEMBER_BADGES.founder);
    if (hosts.has(member.id)) push(member.id, MEMBER_BADGES.host);
    if (validators.has(member.id)) push(member.id, MEMBER_BADGES.validator);
    if (winstonsChoice.has(member.id)) push(member.id, MEMBER_BADGES["winstons-choice"]);

    const totals = countTotalsForMember(input.tastings, member.id);
    for (const track of COUNT_BADGE_TRACK_ORDER) {
      const badge = badgeForCount(track, totals[TRACK_COUNT_KEY[track]]);
      if (badge) push(member.id, badge);
    }
  }

  for (const [memberId, badges] of byMember) {
    badges.sort((a, b) => badgeSortKey(a) - badgeSortKey(b));
    byMember.set(memberId, badges);
  }

  return byMember;
}

export function badgesForMember(
  map: Map<string, MemberBadge[]>,
  memberId: string,
): MemberBadge[] {
  return map.get(memberId) ?? [];
}

export function badgeIdsForMember(map: Map<string, MemberBadge[]>, memberId: string): string[] {
  return badgesForMember(map, memberId).map((badge) => badge.id);
}
