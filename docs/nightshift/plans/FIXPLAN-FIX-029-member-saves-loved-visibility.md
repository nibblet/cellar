# Fix: [FIX-029] `member_saves` documented as "own-only" but SELECT allows cross-member reads

## Problem

STATUS.md and the NCCC conventions describe `member_saves` as "own-only (no cross-member
visibility)." In practice, the RLS SELECT policy (`member_saves_select_all`) allows any
authenticated club member to read any other member's saves — including the `loved` flag, which
STATUS.md separately calls a "private signal for Try Next."

The Cellar tab on member profile pages (`/members/[id]`) silently depends on this cross-member
read capability: `CellarSection` calls `loadCellarProducts(supabase, memberId, "have/want/tried")`
and passes `snapshot.loved` — all of which only work because SELECT is unrestricted. If a future
RLS tightening changed `member_saves_select_all` to own-only, every member profile Cellar tab
would silently go blank with no error.

For 12 friends in a private club this behavior is almost certainly intentional — seeing each
other's shelves is part of the social value — but the documentation does not reflect it.

## Root Cause

`supabase/migrations/20260522000001_member_saves.sql` defines:
- `member_saves_select_all` — no `auth.uid()` restriction on SELECT
- `member_saves_insert_own` — restricts insert to own rows
- `member_saves_update_own` — restricts update to own rows
- `member_saves_delete_own` — restricts delete to own rows

STATUS.md summarizes this as "own-only" without distinguishing read vs. write, creating a false
impression of private shelves. `CLAUDE.md` conventions inherit this description.

## Steps

1. Open `docs/nightshift/STATUS.md`
2. In the **Database Schema Summary** section, find the `member_saves` row:
   > `member_saves`: own-only (no cross-member visibility)
   Replace with:
   > `member_saves`: read by all authenticated members (SELECT); write own-only (INSERT/UPDATE/DELETE). Loved flag is club-visible.
3. In the **Key Conventions in Use** section, find or add a note about member_saves visibility:
   > `member_saves` — Have/Want/Tried/Loved are readable by all 12 club members (supports member
   > profile Cellar tabs). Writes are own-only. The `loved` flag functions as a private palate
   > signal for Try Next but is technically club-visible.
4. Open `CLAUDE.md`
5. In the State section, verify there is no conflicting "private" claim about member_saves.
   If found, update to reflect that reads are club-wide.
6. Run `pnpm lint` — no code changes, lint should pass unchanged.
7. Run `pnpm build` — confirm no regressions.
8. Optionally: confirm with Paul whether cross-member `loved` visibility is intentional or
   should be restricted. If Paul wants `loved` private, add a narrowed SELECT policy in a new
   migration that excludes `loved = true` rows from cross-member reads, and update `CellarSection`
   to only pass `lovedProductIds` when `isOwnProfile = true`.

## Files Modified

- `docs/nightshift/STATUS.md` — corrects member_saves visibility description
- `CLAUDE.md` — removes any conflicting "own-only" description (if present)

## New Files (if any)

_None unless Paul wants to restrict loved visibility — in that case:_
- `supabase/migrations/YYYYMMDDHHMMSS_member_saves_loved_private.sql` — narrow SELECT to
  exclude `loved=true` rows from cross-member reads

## Database Changes (if any)

Only if Paul decides `loved` should be private — see Step 8 above:
```sql
-- Restrict cross-member loved flag visibility
drop policy member_saves_select_all on member_saves;

create policy member_saves_select_own_or_non_loved
  on member_saves for select
  using (
    auth.uid() = member_id
    or loved = false
  );
```
Note: applied via `supabase db push` (manual by Paul).

## Verify

- [ ] Build passes
- [ ] Lint passes
- [ ] STATUS.md correctly describes SELECT as club-wide, write as own-only
- [ ] Member profile Cellar tab still renders other members' Have/Want/Tried shelves
- [ ] `loved` hearts on member profile confirmed to show/hide per Paul's preference
