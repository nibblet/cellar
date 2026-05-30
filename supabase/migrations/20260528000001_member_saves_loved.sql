-- Cellar v1.1: add the private `loved` signal to member_saves.
--
-- loved = a personal "I love this" tap. Stronger positive signal than `tried`,
-- used by the taste-recommendation engine (Phase 8). It is private — it never
-- feeds tastings.recommend or any club-facing aggregate.
--
-- loved implies tried (enforced in application code, mirroring have→tried), so
-- the column carries no DB-level CHECK against tried. Existing member_saves RLS
-- policies (insert/update/delete own) already restrict who can set it.

alter table public.member_saves
  add column if not exists loved boolean not null default false;

-- Per-member lookup of loved products (drives the personal taste vector).
create index if not exists member_saves_loved_idx on public.member_saves (member_id) where loved;
