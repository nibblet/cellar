export type MemberNameFields = {
  name_first: string;
  name_last_initial: string;
};

/**
 * Global member display formatter. Always "First L" (e.g., "Paul C").
 * This is THE identity convention across NCCC — used in tastings, takes,
 * pairings, member tags, and end-of-night recaps. One place to change.
 */
export function formatMemberName(member: MemberNameFields): string {
  const first = member.name_first.trim();
  const initial = member.name_last_initial.trim().charAt(0).toUpperCase();

  if (!first) return initial || "Member";
  if (!initial) return first;
  return `${first} ${initial}`;
}

/** Avatar monogram — first + last initial, e.g. "PC". */
export function formatMemberInitials(member: MemberNameFields): string {
  const first = member.name_first.trim().charAt(0).toUpperCase();
  const last = member.name_last_initial.trim().charAt(0).toUpperCase();

  if (first && last) return `${first}${last}`;
  return first || last || "?";
}
