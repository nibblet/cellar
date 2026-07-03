-- Solo fork reset — remove the multi-user club machinery.
--
-- Drops the invite system and the member-suggestions mailbag. Both assume many
-- members and an admin collecting from them; the solo app has neither.
--
-- Intentionally KEPT:
--   * events            — personal tasting nights still tag tastings; reframed, not removed.
--   * users.role        — the sole user is the owner/admin (kept as an owner flag rather
--                         than triggering a wide admin-gating rewrite).
--
-- Apply this on the forked Supabase project (`supabase db push`). It is additive
-- to the historical migrations; squash to a clean baseline later if desired.

begin;

-- ── Invites ────────────────────────────────────────────────
-- No invite-gated signup in a single-user app.
drop function if exists public.consume_invite_token(text);
drop function if exists public.validate_invite_token(text);
drop table if exists public.invites cascade;

-- ── Suggestions ────────────────────────────────────────────
-- No members sending feature ideas / bug reports to an admin.
drop table if exists public.suggestions cascade;
drop function if exists public.touch_suggestions_updated_at() cascade;

commit;
