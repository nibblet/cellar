# WS4 — "You" Hub Redesign

**Status:** Design approved 2026-05-24. Ready for implementation plan.
**Author:** Paul + Claude (brainstorming session, 2026-05-24).
**Belongs to:** UX/UX refresh wave. First of four planned workstreams (see "Companion workstreams" below).

---

## Why this exists

The bottom-nav label says **You** but routes to `/settings` — a screen that is mostly admin and a sign-out button. There is no surface that says "this is *your* corner of the club." Members can't change their display name or upload an avatar. Badges (already earned via `lib/badges/compute.ts`) only render in the member roster — invisible to the member who earned them. Personal Cellar / Tastings are reachable only via the Members tab visiting your own profile, which is the wrong door.

This redesign builds a real `/you` hub that:
- Surfaces your earned badges with always-visible labels.
- Gives a single launchpad to your Cellar, your Tastings, and (post-WS3) your Pairings.
- Consolidates account/appearance/preferences/sign-out.
- Lets you edit your display name and avatar.
- Becomes the *only* personal door — `/members/[me]` redirects here.

---

## Companion workstreams (out of scope, for context)

This is workstream **4 of 4** in the post-launch UX refresh wave. The others, in build order:

1. **WS4 (this spec)** — You hub redesign.
2. **WS5+WS2 — Face refresh** (merged): Product Detail v3 (Winston-narrated *The Club Says*, segmented Edit/Session action, always-inline depth, flag+replace catalog image, Pairs-With bug fix) + catalog polish (bigger Have/Tried/Want icons with tap-popover tooltips, vitola/size/manufacturer filters).
3. **WS1 — Lounge "Find Your Next"**: 3-button picker (Pairing / Pour / Smoke) that opens 3–5 cellar-first then catalog-adjacent picks. Daily Pour coexists above it.
4. **WS3 — Capture-a-Pairing** (join model): new `pairing_sessions` row joining two tastings, feeds `is_group_validated`, captures pairing-specific notes.

Each ships independently. WS3's existence is the only reason the Pairings card lives in this spec at all — it appears *only after* WS3 lands.

---

## Routing

| Route | Behavior |
|---|---|
| `/you` | New hub page (this spec). Bottom-nav "You" target. |
| `/you/cellar` | Full Cellar view for the viewer: Have / Want / Tried filter chips + grid. Lifted from the current `/members/[me]?tab=cellar` rendering. |
| `/you/tastings` | Full Tastings list for the viewer. Lifted from the current `/members/[me]?tab=tastings` rendering. |
| `/you/settings` | Unified settings page: appearance, **avatar upload**, **display-name edit**, member-since, taste preferences, sign-out at the **top** of the Account section. Lifted and consolidated from `/settings/page.tsx`. |
| `/settings` | Permanent redirect → `/you/settings`. Preserves bookmarks and past-chat deep links. |
| `/members/[id]` | If `id === me`, redirect to `/you` (any `tab` param is mapped: `tab=cellar` → `/you/cellar`, `tab=tastings` → `/you/tastings`, else `/you`). Member page is for viewing **other members only**. Rendering for `id !== me` is unchanged. |
| `/admin/*` | Unchanged. Reached from `/you` via a single "Admin tools →" link (admins only). |
| `/roadmap` | Unchanged. `/you` links to it. |
| `/shelf` | Redirect updated: now points at `/you/cellar`. |

**Bottom-nav match pattern (`bottom-nav.tsx`):** "You" highlights for `/you/*` and `/admin/*` only. Legacy `/settings/*` is handled by the redirect, not by the match pattern.

---

## Page layout — `/you`

```
HERO
  [avatar photo or initial]
  Paul C.
  Member since Aug 2024

  ┌──┐ ┌──┐ ┌──┐ ┌──┐    ┌╌╌┐
  │🍂│ │🥃│ │🎯│ │✨│    │📷│  ← greyed "next badge" slot
  Cellar Pour  Pair  Logger    Logger·2 more

━━━ PERSONAL ━━━━━━━━━━━━━━━━━━━━━

  Winston voice (italic Playfair):
   "You poured Eagle Rare 10 last."   ← derived from most-recent tasting

  Your Cellar              33 have · 6 want · 41 tried  →
   [thumb] [thumb] [thumb]

  Your Tastings            18 logged →
   [thumb] [thumb] [thumb]

  (Your Pairings card — hidden until WS3 ships)

━━━ THE CLUB ━━━━━━━━━━━━━━━━━━━━━

  Roadmap & Suggestions →

━━━ ACCOUNT ━━━━━━━━━━━━━━━━━━━━━

  ⏻ Sign out
  ⚙ Settings & preferences →           (→ /you/settings)
  🛠 Admin tools →                      (admins only, → /admin)
```

Notes on the layout:
- Hero replaces the current `/settings` identity card. Same avatar circle treatment but the inner content is an uploaded photo when present, fallback to the letter initial.
- Badge row uses a **new `"hero"` variant** of `MemberBadges` that adds an always-visible label under each glyph. No tap required. (Compact glyph-only variant remains for roster contexts.)
- The "next badge" slot is a single greyed glyph + tiny caption ("Logger · 2 more"). Single slot, not a list. If no next badge can be computed, omit the slot.
- Stats card has been **cut** (see "Decisions" below). The Winston one-liner ("You poured … last.") replaces it.
- Pairings card is **hidden until WS3 ships**. No placeholder copy.
- Sign-out is at the **top** of the Account section. The full settings/preferences page is one tap deeper.

---

## Personal lane cards

Each card is a `<Card>` linking to its full surface. Inside:

- **Title row**: card name + per-card count strip
  - Cellar → `33 have · 6 want · 41 tried`
  - Tastings → `18 logged`
- **Thumbnail row**: up to 3 most-recent product hero images (uses existing `signImagePaths`). Empty cells render nothing; the row collapses if zero items.
- **Empty state**: Winston one-liner in `<Voice>`. E.g.:
  - Cellar empty: *"The shelf is bare. Mark a few on hand."*
  - Tastings empty: *"Nothing logged yet, sir. Open the humidor."*

Data sources (server-loaded; share fetches where possible):
- Cellar → `member_saves` filtered by `member_id = me` (existing `loadCellarSnapshot`).
- Tastings → `tastings` filtered by `user_id = me`, joined to `products` for thumbnails.
- Pairings → from WS3's `pairing_sessions` table (not in this spec).

---

## Winston one-liner — "you last poured…"

A single italic-Playfair line at the top of Personal. Pulled from the member's most-recent tasting (any product type).

Templates:
- Bourbon: *"You poured **{product.name}** last."*
- Cigar: *"You lit **{product.name}** last."*
- Neither (no tastings): omit the line entirely; the Cellar/Tastings empty states carry the page.

Implementation: extend the same Tastings query already fetched for the Tastings card — first row is the one-liner subject, all rows are the thumbnail source.

---

## Hero hero (badges)

### Earned badges
- Render `MemberBadges` with new `variant="hero"`: glyph at current size, **label in `font-display text-[10px] uppercase tracking-widest text-foreground-subtle`** centered under the glyph.
- Layout: horizontal row, wrap to second row on overflow.
- No tap interaction needed on `/you` — label is always visible.

### Next badge slot (single)
- One additional muted slot to the right of earned badges, separated by a small visual gap.
- Greyed glyph + caption like `Logger · 2 more`.
- Computed via a new `lib/badges/next.ts`:
  - Loop the badge definitions in definition order.
  - For each unearned badge, compute the gap to the earning criteria.
  - Return the *closest* one (smallest gap). Tie-break by definition order.
- If no unearned badge is computable, omit the slot. Don't render an empty placeholder.

### Other surfaces (unchanged)
- Member roster rows and other member profiles keep the existing `"inline"` and `"profile"` variants (compact glyph-only).
- A follow-up ticket (see "Follow-up tickets" below) will add tap-popover support to those variants. Out of scope for this spec.

---

## `/you/settings`

One long page. Sections in this order:

1. **Identity**
   - Avatar upload (square crop, stored under `storage://avatars/<userId>.jpg`, signed-URL render).
   - Display-name edit: `name_first` + `name_last_initial` form. Validates the two-Paul case still works after edit. Server Action with `useActionState`.
   - Member-since editor (existing `MemberSinceEditor`).
2. **Appearance**
   - Existing `ThemeToggle`.
3. **Taste preferences**
   - Existing `PreferencesForm`. **Not split into its own route** — discoverability matters more than route purity (per H2).
4. **The Club**
   - Roadmap & Suggestions link (unchanged).
5. **Account**
   - **Sign out** at the top.
   - (No other items here; admin tools moved out per H8.)

Admin block moves OFF this page; admins reach `/admin` via the "Admin tools →" link on `/you`.

---

## Component changes

### New
- `apps/web/src/app/(app)/you/page.tsx` — the hub. Server component.
- `apps/web/src/app/(app)/you/settings/page.tsx` — unified settings page (consolidates current `/settings/page.tsx`).
- `apps/web/src/app/(app)/you/cellar/page.tsx` — full personal Cellar view (lifts the rendering currently inside the Members profile Cellar tab).
- `apps/web/src/app/(app)/you/tastings/page.tsx` — full personal Tastings view (lifts the Members profile Tastings tab rendering).
- `apps/web/src/app/(app)/you/_components/personal-card.tsx` — Cellar / Tastings card primitive used in the Personal lane.
- `apps/web/src/app/(app)/you/_components/avatar-uploader.tsx` — client component for the identity section (upload + crop + save).
- `apps/web/src/app/(app)/you/_components/display-name-form.tsx` — Server Action form (`useActionState`).
- `apps/web/src/lib/badges/next.ts` — `nextBadgeFor(userId): { badge: BadgeDefinition; gap: string } | null`.
- `apps/web/src/lib/aggregation/top-flavor-for-member.ts` — currently unused by `/you` (stats card cut), but kept on the roadmap for future stats. **Skip from this spec.**

### Modified
- `apps/web/src/app/(app)/settings/page.tsx` → server-side `redirect('/you/settings')`.
- `apps/web/src/app/(app)/members/[id]/page.tsx` → if `id === me`, server-side `redirect('/you'|'/you/cellar'|'/you/tastings')` based on `tab` query param.
- `apps/web/src/app/(app)/shelf/route.ts` (or current shelf redirect) → redirect to `/you/cellar`.
- The Cellar / Tastings tab rendering currently inside `members/[id]/page.tsx` is **extracted into shared components** so it can be reused by both `/you/cellar`, `/you/tastings`, and the existing `/members/[other]` view.
- `apps/web/src/components/nav/bottom-nav.tsx` → "You" href becomes `/you`, match pattern `/^\/(you|admin)/`.
- `apps/web/src/components/members/member-badges.tsx` → add `"hero"` variant.
- `apps/web/src/lib/badges/load.ts` → if needed, expose a single-member loader optimized for the hero context.

### Untouched
- `lib/badges/definitions.ts`, `lib/badges/compute.ts` — no new badges, no logic change.
- `lib/cellar/load.ts`, `lib/preferences/load.ts` — already return what we need.
- `MemberTag`, `TastingCard`, `CatalogCard` — no changes.

---

## Storage: avatars

- Bucket: `avatars` (new).
- Path: `{userId}.jpg` (overwrite on re-upload).
- Public read? **No.** Signed-URL on render (same pattern as `signImagePaths`).
- Mime: `image/jpeg`, `image/png`, `image/webp`. Max 4MB pre-resize.
- Client compresses to ~512px square JPEG before upload.
- Migration: create the bucket + RLS (`insert / update / delete` allowed only when `auth.uid()::text = name without extension`).
- Database: add `users.avatar_url text` (nullable). NOT the signed URL; the storage path. Render layer signs on demand.

---

## Data fetching on `/you` (per page load)

Single server render, fired in parallel:

```ts
const [
  profile,            // users row for the viewer
  cellarSnapshot,     // member_saves rows
  recentTastings,     // tastings + product join, limit 4 (1 for one-liner + 3 thumbnails)
  cellarRecentProducts, // products for the 3 most-recent have/want/tried rows
  badges,             // earned badges
  nextBadge,          // computed from badges + counts
  preferences,        // unchanged (used to pre-warm /you/settings link state)
] = await Promise.all([...]);
```

Counts (`tastings logged`, etc.) come from `count: 'exact'` projections on the same queries — no extra round-trips.

---

## Testing posture

### Unit
- `lib/badges/next.ts` — empty member, one earned, all earned, tie-break by definition order, no computable next.
- `MemberBadges` `"hero"` variant renders label and glyph; truncates label correctly.
- Display-name validation: rejects empty, accepts two-Paul case (`Paul C` and `Paul S` coexist).

### Component
- `/you` server component renders all visible lanes against seeded data.
- Admin link appears only for `role = 'admin'`.
- Pairings card does not render (until WS3 ships).

### Integration
- `/settings` → 301-equivalent `redirect()` to `/you/settings`.
- `/members/[me]` → `redirect('/you')`.
- Avatar upload writes to bucket, sets `users.avatar_url`, re-renders with signed URL.

### Manual
- iPhone viewport (375 / 390 / 430): badge row wraps cleanly with 4+ badges.
- Tap "Sign out" — confirms the existing `signOut` Server Action still works at its new location.
- Visit Cellar/Tastings cards: thumbnails load from signed URLs.

---

## Decisions log

| ID | Decision | Source |
|---|---|---|
| D1 | Replace Daily Pour on Lounge with Find Your Next picker; keep Daily Pour above it | Q&A `daily_pour_fate=coexist` |
| D2 | You hub at `/you` with child routes (`/you/settings`); legacy `/settings` redirects | Q&A `you_routes=hub_with_children` |
| D3 | Hub redesign only (no `/roadmap` move) | Q&A `you_scope=hub` |
| D4 | Personal cards show count + 2-3 thumbnails, link out to full surface | Q&A `personal_lane=count_plus_thumbs` |
| D5 | Badge labels always visible on `/you` (no tap needed) | Q&A `badge_tooltip=label_below` |
| D6 | `/roadmap` route untouched; `/you` links to it | Q&A `roadmap_route=leave_link` |
| D7 | Admin block stays gated on the You surface (refined by H8 → single link) | Q&A `admin_location=keep_you` + red-team H8 |
| D8 | Personal day-1 surfaces: Cellar, Tastings, Stats(→cut), Pairings(→deferred) | Q&A `personal_surfaces` + red-team I3, H5 |
| D9 | Avatar + display-name edit added to `/you/settings` | Red-team I1 |
| D10 | Settings + preferences unified on one page (no split) | Red-team H2 |
| D11 | `/members/[me]` redirects to `/you` (with `tab` param mapped to `/you/cellar` or `/you/tastings`); Members tab is for others only | Red-team H3 + self-review |
| D11a | Cellar and Tastings tab renderings extracted into shared components so `/you/cellar`, `/you/tastings`, and `/members/[other]` all consume the same surface | Self-review |
| D12 | Stats card cut from v1; replaced by Winston "you last poured…" one-liner | Red-team H5 + I4 |
| D13 | Sign-out moves to top of Account section | Red-team H6 |
| D14 | Admin block collapses to single "Admin tools →" link → `/admin` | Red-team H8 |
| D15 | Top-flavor source = recommended → have → all (deferred with stats; documented for the day stats return) | Red-team H4 |
| D16 | Bottom-nav match pattern = `/you` + `/admin` only | Red-team H9 |
| D17 | "Next badge" greyed slot on hero | Red-team I2 |
| D18 | Pairings card omitted until WS3 ships (no placeholder copy) | Red-team I3 |
| D19 | Tap-popover badge tooltip for other surfaces tracked as follow-up | Red-team I5 |

---

## Follow-up tickets (explicitly NOT in this spec)

- **Tap-popover badge tooltip** for `MemberBadges` `"inline"` and `"profile"` variants — fixes the `title=""` no-op on iOS Safari everywhere badges appear. Small ticket, but cross-cuts member roster and member profile pages.
- **Stats card v1** — once a comparator exists (club median or week-delta), reintroduce the stats card on the You hero. Implementation already sketched in this doc (`top-flavor-for-member.ts`).
- **WS5 polish bundle** — Cigars feed Have/Tried/Want icon sizing + filter additions (vitola, size, manufacturer). Lives in the Face Refresh spec.

---

## Risks

- **Avatar storage bucket** is the first new bucket since launch. Verify RLS policies don't accidentally lock everyone out. Test by uploading as Paul, then reading as a different member.
- **`/members/[me]` redirect** changes the Members-tab UX for the viewer themselves. Members who've gotten used to "tap my own row in Members to see my Cellar" will get bounced to `/you` (or `/you/cellar` / `/you/tastings` if a tab is deep-linked). This is the intended outcome (one door) but worth a heads-up note when the change ships.
- **Shared Cellar/Tastings components.** Extracting the tab rendering means both the `/you/*` pages and `/members/[other]` consume the same view. Verify the components don't accidentally couple to "viewer === target" assumptions (e.g., the Cellar toggle only renders when viewing your own — that already works via auth check, but worth a test).
- **Display-name edit** could break the two-Paul invariant if someone enters `Paul X` with the same `name_last_initial` as the other Paul. The form should warn but not block — `formatMemberName` already handles ambiguous cases by tightening to `First L.` style.
- **Bottom-nav match pattern** change is a one-line edit but touches every authenticated page render. Smoke test routes that share the prefix (none in current tree, but future-proof).
