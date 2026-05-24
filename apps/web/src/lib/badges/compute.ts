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

function earliestByCreatedAt(rows: BadgeTastingRow[]): string | null {
  if (rows.length === 0) return null;
  return rows.reduce((earliest, row) => (row.created_at < earliest.created_at ? row : earliest))
    .user_id;
}

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

export function computeMemberBadges(input: BadgeComputeInput): Map<string, MemberBadgeId[]> {
  const byMember = new Map<string, MemberBadgeId[]>();
  const push = (memberId: string, badge: MemberBadgeId) => {
    const list = byMember.get(memberId) ?? [];
    if (!list.includes(badge)) list.push(badge);
    byMember.set(memberId, list);
  };

  const founders = computeFounders(input.members);
  const validators = computeValidators(input.tastings, input.events);
  const winstonsChoice = computeWinstonsChoice(input.tastings, input.winstonPairs);

  const hosts = new Set(
    input.events.map((e) => e.host_user_id).filter((id): id is string => Boolean(id)),
  );

  const counts = new Map<string, number>();
  for (const row of input.tastings) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }

  const firstLight = earliestByCreatedAt(input.tastings.filter((t) => t.recommend));
  const firstPour = earliestByCreatedAt(input.tastings.filter((t) => t.product_type === "bourbon"));
  const firstSmoke = earliestByCreatedAt(input.tastings.filter((t) => t.product_type === "cigar"));

  for (const member of input.members) {
    if (founders.has(member.id)) push(member.id, "founder");
    if (member.id === firstLight) push(member.id, "first-light");
    if (member.id === firstPour) push(member.id, "first-pour");
    if (member.id === firstSmoke) push(member.id, "first-smoke");
    if ((counts.get(member.id) ?? 0) >= 10) push(member.id, "tenth-contribution");
    if (hosts.has(member.id)) push(member.id, "host");
    if (validators.has(member.id)) push(member.id, "validator");
    if (winstonsChoice.has(member.id)) push(member.id, "winstons-choice");
  }

  for (const [memberId, badges] of byMember) {
    badges.sort((a, b) => BADGE_DISPLAY_ORDER.indexOf(a) - BADGE_DISPLAY_ORDER.indexOf(b));
    byMember.set(memberId, badges);
  }

  return byMember;
}

export function badgesForMember(
  map: Map<string, MemberBadgeId[]>,
  memberId: string,
): MemberBadge[] {
  return (map.get(memberId) ?? []).map((id) => MEMBER_BADGES[id]);
}
