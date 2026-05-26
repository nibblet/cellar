export type MemberBadgeId =
  | "founder"
  | "host"
  | "validator"
  | "winstons-choice";

export type MemberBadge = {
  id: string;
  label: string;
  mark: string;
  hint: string;
};

export const MEMBER_BADGES: Record<MemberBadgeId, MemberBadge> = {
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
  "validator",
  "winstons-choice",
  "host",
];
