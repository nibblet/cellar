export type MemberBadgeId =
  | "first-light"
  | "first-pour"
  | "first-smoke"
  | "tenth-contribution"
  | "founder"
  | "host"
  | "validator"
  | "winstons-choice";

export type MemberBadge = {
  id: MemberBadgeId;
  label: string;
  mark: string;
  hint: string;
};

export const MEMBER_BADGES: Record<MemberBadgeId, MemberBadge> = {
  "first-light": {
    id: "first-light",
    label: "First Light",
    mark: "1L",
    hint: "First tasting recommended to NCCC",
  },
  "first-pour": {
    id: "first-pour",
    label: "First Pour",
    mark: "1P",
    hint: "First bourbon tasting logged",
  },
  "first-smoke": {
    id: "first-smoke",
    label: "First Smoke",
    mark: "1S",
    hint: "First cigar tasting logged",
  },
  "tenth-contribution": {
    id: "tenth-contribution",
    label: "Tenth Contribution",
    mark: "10",
    hint: "Ten tastings logged",
  },
  founder: {
    id: "founder",
    label: "Founder",
    mark: "F",
    hint: "Joined within the club's first thirty days",
  },
  host: {
    id: "host",
    label: "Host",
    mark: "H",
    hint: "Hosted a meetup",
  },
  validator: {
    id: "validator",
    label: "Validator",
    mark: "V",
    hint: "First to validate a pairing at a meetup",
  },
  "winstons-choice": {
    id: "winstons-choice",
    label: "Winston's Choice",
    mark: "W",
    hint: "Recommended a product Winston narrates in a pairing",
  },
};

export const BADGE_DISPLAY_ORDER: MemberBadgeId[] = [
  "founder",
  "first-light",
  "first-smoke",
  "first-pour",
  "validator",
  "winstons-choice",
  "host",
  "tenth-contribution",
];
