import type { GroupVoice, MemberTake } from "./group-voice";

/**
 * Winston one-liner for THE CLUB SAYS. Pure function — unit tested.
 */
export function buildClubSaysProse(
  groupVoice: GroupVoice,
  myTake: MemberTake | undefined,
): string | null {
  const { member_count, recommend_count, tag_cloud } = groupVoice;

  if (member_count === 0) {
    return "No one's weighed in yet. Be the first.";
  }

  const parts: string[] = [];

  if (recommend_count > 0) {
    const recTakes = groupVoice.takes.filter((t) => t.recommend);
    const names = recTakes.slice(0, 2).map((t) => t.display_name);
    if (recommend_count === 1 && names[0]) {
      parts.push(`${names[0]} recommends it`);
    } else if (recommend_count <= names.length) {
      parts.push(`${names.join(" and ")} recommend it`);
    } else {
      parts.push(`${recommend_count} of ${member_count} recommend it`);
    }
  } else {
    parts.push(`${member_count} ${member_count === 1 ? "member has" : "members have"} tried it`);
  }

  const topTags = tag_cloud.slice(0, 3).map((e) => e.label);
  if (topTags.length > 0) {
    const more = tag_cloud.length - topTags.length;
    const tastePhrase =
      more > 0
        ? `the room tasted ${formatList(topTags)}, and ${more} more`
        : `the room tasted ${formatList(topTags)}`;
    parts.push(tastePhrase);
  }

  if (myTake && myTake.chips.length > 0 && topTags.length > 0) {
    const overlap = myTake.chips.filter((c) =>
      topTags.some((t) => t.toLowerCase() === c.toLowerCase()),
    );
    if (overlap.length > 0) {
      parts.push(`your notes match on ${formatList(overlap)}`);
    }
  }

  return `${parts.join(". ")}.`;
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
