export const PENDING_SIGNUP_COOKIE = "nccc_pending_signup";

export type PendingSignup = {
  token: string;
  name_first: string;
  name_last_initial: string;
};
