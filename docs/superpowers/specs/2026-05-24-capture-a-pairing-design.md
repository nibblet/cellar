# WS3 — Capture-a-Pairing (Join Model)

**Status:** Approved 2026-05-24. Implements the fourth UX refresh workstream.

## Behavior

Members capture cigar + bourbon together in one flow:

1. **Pairings tab** — brass **Capture a pairing** opens photo-first flow (`/pairings/capture`).
2. One photo → parallel vision (cigar + bourbon) → confirm or change via catalog search.
3. Collapsed pairing taste: one recommend, optional chips + pairing note, optional meetup.
4. Submit creates `pairing_sessions` row + two linked tastings (`pairing_session_id` FK).
5. Lounge feed renders one **pairing card** per session (not two tasting cards).
6. When both halves are recommended, `pairings_cache.is_group_validated` syncs (moss surfaces).

Also reachable from pairing detail **Tasted this pairing** (existing CTA).

## Surfaces

| Surface | Change |
|---|---|
| `/pairings` | Capture CTA at top |
| `/pairings/capture` | Photo-first identify + confirm; catalog picker fallback |
| `/you` | **Your pairings** Personal card |
| `/you/pairings` | Full list of captured pairings |

Lounge feed groups by `pairing_session_id` into a single pairing card (shipped).

## Schema

`pairing_sessions` — user, cigar, bourbon, note, event, photo path, timestamps.
`tastings.pairing_session_id` → FK to `pairing_sessions`.

## Club validation

Extended `checkGroupValidation`: meetup path (unchanged) OR pairing capture with both recommends.
