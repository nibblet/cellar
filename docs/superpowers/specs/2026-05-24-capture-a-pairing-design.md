# WS3 — Capture-a-Pairing (Join Model)

**Status:** Approved 2026-05-24. Implements the fourth UX refresh workstream.

## Behavior

Members capture cigar + bourbon together in one flow:

1. **Pairings tab** — brass **Capture a pairing** opens catalog picker (`/pairings/capture`).
2. Pick cigar, then bourbon → **Tasted this pairing** form (`/pairings/[cigar]/[bourbon]/taste`).
3. One photo, per-product recommend + chips, shared pairing note, optional meetup tag.
4. Submit creates `pairing_sessions` row + two linked tastings (`pairing_session_id` FK).
5. When both halves are recommended, `pairings_cache.is_group_validated` syncs (moss surfaces).

Also reachable from pairing detail **Tasted this pairing** (existing CTA).

## Surfaces

| Surface | Change |
|---|---|
| `/pairings` | Capture CTA at top |
| `/pairings/capture` | Two-step catalog picker |
| `/you` | **Your pairings** Personal card |
| `/you/pairings` | Full list of captured pairings |

Feed dual-card rendering remains deferred (ui-refresh-v2).

## Schema

`pairing_sessions` — user, cigar, bourbon, note, event, photo path, timestamps.
`tastings.pairing_session_id` → FK to `pairing_sessions`.

## Club validation

Extended `checkGroupValidation`: meetup path (unchanged) OR pairing capture with both recommends.
