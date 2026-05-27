# NCCC — Roadmap

A living catalog of ideas inspired by other apps, translated into NCCC's voice, then sequenced for build. **Phases 0–7 of `nccc-implementation-plan.md` are shipped on `main` as of 2026-05-20.** Everything below the "Current status" section is post-launch candidate scope, ranked by impact.

**Translation rules** (from `CLAUDE.md` + `design-system.md`):
- No 1–100 scores, star ratings, or user-facing sliders on the **face**.
- The flavor wheel is **silent infrastructure** — surface as aggregate tag clouds, never as input sliders.
- Winston is the system voice. Brass is the single primary action. Ember = lit recommend. Moss = club-validated pairing.
- Private to 12 members. No public feeds, no follower counts.

---

## Current status — 2026-05-24

What's actually on `main` vs. what was planned. ✅ = shipped, 🟡 = partial / base ships but enhancements pending, ❌ = not started.

| Phase | Status | Notes |
|---|---|---|
| 0 — Foundation | ✅ | Email+password auth, reset flow, design tokens, primitives, Supabase clients, `formatMemberName`, 5-tab nav |
| 1 — Catalog seeding | 🟡 | bourbonExplorer + StickPicks seeded. Enrichment running (see catalog state below). Cobb whiskey seeder built + updated to seed Cellar. Schema enhancements (style_family, tier_seed, dsp_code, editorial_baseline_profile, product_adjustments) deferred. |
| 2 — Capture & identify | 🟡 | Camera + GPT-5 mini vision + fuzzy-match working end-to-end. UPC barcode scanner deferred. |
| 3 — Tasting flow | 🟡 | One-tap "Recommend to NCCC" with optional chips + note + silent wheel mapping. **The Session v1 shipped** — optional `/products/[id]/session` path (thirds / nose-palate-finish, Winston help, finish → Recommend). Quick Recommend remains default. Ambient timer deferred. |
| 4 — Product detail | 🟡 | Face complete: group voice, recommend bar, member takes, tag cloud, Pairs With, Facts, Construction panel. Depth view (pure SVG radar) ships. **Per-member adjustments + moss consensus shape NOT shipped.** |
| 5 — Feed/Members/Events | 🟡 | All three pages + 4-tab center-FAB nav. Feed tabbed (For You / Cigars / Bourbons). Member profile now has Tastings / Cellar tabs. Preferences + FOR YOU badge shipped. |
| 5.5 — The Cellar | ✅ | `member_saves` table (have/want/tried), `setCellarState` action, `CellarToggle` on product detail, compact controls on catalog cards, capture follow-up prompt, member profile Cellar tab, `/shelf` redirect, cellar bias wired into Daily Pour. 177 unit tests. |
| 6 — Pairing engine | 🟡 | 8 rules, scoring, group validation, Winston prose, cache, `/pairings/[cigar]/[bourbon]` page, Pairs With. **Pick My Pour** (cellar-driven on-demand pick) shipped. **WS3 Capture-a-Pairing shipped 2026-05-24** — catalog picker, `pairing_sessions` join model, `/you/pairings`, moss cache sync on dual-recommend captures. |
| 7 — Polish / admin | 🟡 | Settings, sign-out, admin invites, product edit, logo, recap card, Winston illustration variants. Education library NOT shipped. **WS4 You hub shipped 2026-05-24** — `/you` hub with badge hero, personal Cellar/Tastings cards, unified `/you/settings` (avatar + display name), `/you/cellar` + `/you/tastings`, redirects from `/settings`, `/shelf`, `/members/[me]`. **WS5+2 face refresh shipped 2026-05-24** — Winston Club Says prose, segmented tasting actions, inline depth, catalog filter polish. |
| 8 — Daily Pour | ✅ | Home-page hero, deterministic FNV-1a pick, preference + cellar bias, Winston voice, moss club-validated badge, prose cache on home. **WS1 Find Your Next shipped 2026-05-24** — trio below Daily Pour (Today's Pairing / Pour / Smoke sheets, cellar-first). Pick My Pour removed from home hero; still on Cellar tab. |

**Tests:** 242 unit tests passing (wheel math, pairing rules, scoring, identity, preference derivation + matching, cellar mutex + bias, pick-pour selector, session merge, badges next + hero variant, find-next merge, pairing picker filter).

**Catalog state — as of 2026-05-22 enrichment run:**

| Metric | Cigars | Bourbons |
|---|---|---|
| Total confirmed | 833 | 2,098 |
| Has `image_url` | 459 (55%) | 237 (11%) |
| Has `trait_vector` | 783 (94%) | 2,098 (100%) |
| Both image + vector | 410 (49%) | 237 (11%) |

- Cigars are nearly fully vectorized (94%) and well-specced (99% have 3+ spec fields). Image gap: ~374 still without photos.
- Bourbons are 100% vectorized. Image enrichment barely started (11%). Bourbon spec keys use different field names than cigars — the enrichment pass needs to populate `proof`, `age_years`, `distillery` etc. consistently.
- **Club staple gap** (audited 2026-05-21): 13 of 24 spot-checked NCCC staples missing from the 833-cigar catalog (Padron 1964/1926, Liga Privada No. 9/T52, My Father Le Bijou, Davidoff Nicaragua, Tatuaje Black, Oliva Melanio, La Aroma de Cuba Mi Amor, Aging Room Quattro, Diesel Whiskey Row, Ashton VSG, Nica Rustica).

---

## Pre-launch checklist (small, operational)

The app is feature-complete for a private 12-person launch. These are the lightweight tasks before inviting all 11 friends:

1. **Drop the NCCC logo PNG** at `apps/web/public/icons/nccc-logo.png`. (User placed a copy at `apps/web/public/nccc-logo.png` — needs to move into `/icons/` or the `<NCCCLogo />` component path needs updating.)
2. **Run the Cobb whiskey seeder.** Save the xlsx at `apps/web/scripts/seed/data/private/cobb-whiskey.xlsx` (gitignored), then `pnpm seed:cobb-whiskey`. Adds 98 curated bottles + enriches overlapping bourbonExplorer rows.
3. **Fix the failing bourbon-parser unit test.** The "spice" assertion is stale now that we added it as a baking-spice synonym; the test expected it to be unmapped. Update the test to reflect the new (correct) behavior.
4. **Re-run `pnpm seed:bourbons`** to apply the v0.1-syn1 synonym expansion across the 1,350 bourbonExplorer rows.
5. **Promote Paul to admin** in Supabase: `update users set role = 'admin' where id = '<your uuid>';`
6. **Smoke-test the full flow** end-to-end in the browser: capture → identify → recommend → product detail → pairing screen → recap card.
7. **Send the first invite** to a single trusted friend before broadcasting. Verify the full onboarding works.

That's ship-ready. Everything below is post-launch.

---

## UI/UX Pass v1 — sequenced ahead of Tier 1 features

> **v1 shipped 2026-05-21.** Full detail in `planning/ui-refresh-plan.md`. A second pass — copy tweaks, pairing detail restructure, "Tasted this pairing" capture path, "The reviewers say" depth block, **Cellar/Wishlist lightweight entry point**, and external shop link — is captured in `planning/ui-refresh-v2.md` (agreed 2026-05-21). v2's Cellar primitive is the on-ramp for the full Phase 5.5 Cellar in Tier 1 #1 below; the richer scope here (pour levels, finished/on-hand, Paul's xlsx import) layers onto the same `member_saves` table v2 introduces.

Agreed 2026-05-20 (Paul + Claude design conversation). The baseline app is shipped and functional, but several surfaces need a visual pass before we keep stacking features on top. Build in order — each step sets the visual vocabulary the next one inherits.

**Working principles for this pass:**
- iPhone-first. Test every change in mobile viewport before declaring done.
- Honor `docs/design-system.md`: brass = single primary action, ember = lit recommend, moss = club-validated pairing, etched dividers at section breaks, Winston voice in italic Playfair.
- Run `anthropic-skills:frontend-design` per-screen, not whole-app — keeps the existing identity intact.
- Photo-as-card is the new visual primitive. Overlays, scrims, etched glass chips inherit from the feed work.

### Bug bar — fix before/with the pass
- **Feed overflow:** content wider than the mobile viewport. Likely a `flex` child without `min-w-0` or an unconstrained `<img>`. Audit the whole `(app)/` shell for horizontal overflow while we're in there.
- **Bottom nav overflow:** the 5-tab grid pushes past `max-w-md` on narrow viewports. Will be resolved by the nav redesign below but verify the fix.

### Sequence

#### UX-1. Feed photo-overlay redesign — **first**
Pivot the feed from list-row (64px thumb + text) to **photo-as-card** with overlays. Highest-visited screen; sets the vocabulary for product detail and member profile.

- Photo becomes the card (sepia treatment preserved, full-bleed within card padding).
- Member tag (`formatMemberName` → "Paul C") overlaid bottom-left, sepia gradient scrim behind for legibility, Playfair italic.
- 2–3 descriptor chips overlaid bottom-right, etched-glass style (low-opacity surface, subtle border).
- Ember dot moves to top-right corner when lit.
- Product name + brand remain below the photo in a compact strip.
- Fix horizontal overflow as part of this work.

#### UX-2. Bottom nav redesign — center-FAB + icons
- **4 tabs + center Capture FAB**, not 5 equal tabs. Brass-rimmed elevated circle for Capture (still respects "brass = primary action" since Capture IS the primary action of the shell).
- Outline icons above labels (Lucide or custom etched glyphs). Stroke thickens on active.
- Brass underline stays for active state (don't fill — would break brass rule).
- Drop **Meetups** from primary nav → move under **You**. Surface a Meetups card on Feed when one is scheduled in the next 48h.
- Final shape: `[Feed] [Members] [⊕ Capture] [Pairings] [You]`.
- Verify overflow is gone at all iPhone widths (320 / 375 / 390 / 430).

#### UX-3. Product detail deep-dive design
Most-visited screen after feed. Currently functional but flat. Needs to support **dense info without losing the clean face**.

- Hero photo with overlay treatment inherited from Feed (member who first captured + their descriptors).
- "THE CLUB SAYS" tag cloud as the visual centerpiece — bigger, more typographic, less list-y.
- Winston voice intro line (italic Playfair).
- CONSTRUCTION section (Tier 2 item #6 promoted here — data's already in `products.specs`).
- THE FACTS as a dense info-strip, not a stacked list (e.g. `Proof 100 · Age 7yr · Mashbill 51/39/10`).
- Pairs With panel — moss accent when club-validated.
- "Open the depth" tap-through scaffolded (radar chart itself is Tier 2 #4, but the affordance lands here).

#### UX-4. Capture flow — add wow factor
Currently a form. Should feel ceremonial — like a Polaroid being developed.

- Photo capture → animated sepia develop transition (1–2s, skippable).
- Chip selection as tactile press-and-hold pills, not checkboxes. Selected chips animate up with weight.
- Recommend-to-NCCC as the brass primary at bottom (already is, but elevate it).
- Winston does NOT appear here (per design system — preserve).
- Optional: shutter haptic on capture (iOS PWA supports `navigator.vibrate` on some installs).

#### UX-5. You / Settings buildout — **decisions locked 2026-05-21**

**Hero-first layout** ✅ shipped 2026-05-21:
- Big initial circle + name + email + Admin chip + member-since line.
- Appearance toggle (Light / Dark / Auto) sits just below the hero.

**Meetups placement** (decided): right below the hero in Settings.
Already shipped in the same pass.

**Preferences** (decided — keep simple, positives only, no "avoids"):
- **Bourbon**: style families to lean toward (wheated / high-rye /
  standard / single malt / Irish whiskey / rye). Proof band (≤100 /
  100–115 / ≥115). Multi-select; no "things to avoid" — we want the
  Winston to suggest *toward* taste, not against.
- **Cigar**: strength bands (mild / medium / medium-full / full).
  Wrapper-color leanings (claro / colorado / maduro / oscuro) as
  multi-select.
- Member can update anytime; defaults are all-unselected so the
  Winston starts neutral until the member opts in.
- Feeds Tier 2 #5 (Pairing Preferences) AND the new "match badge"
  surface (Tier 2 #5a, see below).

**"Flag/badge selections" clarified**: small "for you" pill that
appears on Feed tasting cards (and elsewhere) when the underlying
product matches the *viewer's* stated preferences. Not the
achievement badges (those are Tier 3 #15). This becomes a separate
Tier 2 entry — see #5a below.

**Cellar placement** (decided): lives on the member's profile, not
its own bottom-nav tab. Rationale:
- Nav slots are full and Cellar is high-personal, low-traffic-per-day.
- Inventory IS identity for a collector — "what's on Paul's shelf"
  reads naturally as part of Paul's profile.
- Each member's profile (/members/[id]) gets tabs: Tastings (today's
  default), Cellar, Favorites.
- The Settings "Club" section gets a "Your cellar" deep-link to the
  member's own profile with the Cellar tab active.
- Social bonus: members can browse each other's cellars while
  scrolling Members. Adds texture to the Members page that was
  flagged as "too light" in the 2026-05-21 smoke test.

**Status:** UX-5 is now scoped and ready to build whenever bandwidth
allows. The expanded surfaces (Favorites, History, Preferences,
Cellar tab) are Tier 1 / Tier 2 items in their own right; UX-5 is
the layout glue that holds them.

---

## Post-launch roadmap, prioritized by impact

Ranked by what NCCC members will most notice / value after they're using the app daily. **Build these in tier order**, but each tier is parallelizable internally.

### Tier 1 — Post-launch features (all four shipped as of 2026-05-23)

These are the post-launch features most likely to surface in member feedback within the first month.

#### 1. The Cellar (Phase 5.5) — **✅ v1 shipped 2026-05-22**

**As built** (see `planning/cellar-v1-plan.md`):
- `member_saves` table: have / want / tried per (member, product). have/want mutex enforced by CHECK constraint + app logic. have implies tried. Zero rows deleted, not stored.
- `setCellarState` server action, `loadCellarSnapshot`, `loadCellarProducts`, `applyCellarBias`.
- Auto-tried: every Recommend-to-NCCC tasting automatically sets tried=true.
- `CellarToggle` (3-pill) on product detail. Compact `CellarCardControls` on catalog cards (Cigars/Bourbons tabs). Contextual "Add to cellar?" prompt on `?just_saved=1` banner.
- Member profile Tastings / Cellar tab switcher. Cellar tab: Have / Want / Tried filter chips, product list, per-state Bartender empty states.
- `/shelf` → `/members/[me]?tab=cellar` redirect.
- Cellar bias wired into Daily Pour candidate ranking (+10 max, viewer-only overlay).
- Cobb whiskey seeder updated to seed Have+Tried for Paul's 98 bottles when `PAUL_USER_ID` is set.

**Deferred to full Phase 5.5:**
- Pour levels (full/half/heel/empty) and pour count.
- Finished vs. On Hand split.
- Dedicated bottom-nav Cellar tab.
- Bulk backfill UI ("mark everything you've had" sweep).
- Social counts ("X club members have this") on product detail.

**Stickiness signal:** Daily for active collectors.

---

#### 2. The Session — restructure the tasting flow (Phase 3 enhancement) — **✅ v1 shipped 2026-05-23**

**As built (lightweight v1 — Recommend stays the default fast path):**
- Optional route at `/products/[id]/session` — ghost **"Open a Session →"** link on product detail; brass **Recommend to NCCC** unchanged.
- Cigar: **First Third / Second Third / Final Third** tabs. Bourbon: **Nose / Palate / Finish** tabs.
- Per-phase chips (reuse `ChipInput`) + optional one-line note. Phases skippable — finish with zero input still allowed.
- Collapsible Winston help (*"What are thirds?"* / *"What's nose, palate, finish?"*).
- Finish step: **Recommend to NCCC** / Pass + optional **Add to Cellar** checkbox.
- No new schema — phased chips merge into existing `tastings.chips`; phase notes concatenate into `tastings.note` via `merge-session.ts`.
- Link back to one-tap `/recommend` from the session page footer.

**Deferred from original scope:**
- Renaming the Recommend flow to "The Session" (v1 keeps both paths).
- Optional ambient timer.
- `product_adjustments` / per-phase persistence for Depth view.
- "Try this tonight → next Session" from pair detail.

**Stickiness signal:** Members who care about the ritual will use The Session for every smoke. The data captured is also richer for the pairing engine.

---

#### 3. The Daily Pour (Phase 8 — NEW) — **✅ shipped 2026-05-21**
**As built (commit 321ad0e):**
- Home-page hero card sits above the For You feed body only (catalog tabs stay catalog-pure).
- Deterministic per-member-per-day pick via FNV-1a hash of `<memberId>|<UTC date>` modulo the candidate pool; rotates at UTC midnight.
- Candidate pool: preference-biased — match cigars against the member's prefs, take up to 5, run the pairing engine in parallel. Falls back to top 20 club-validated rows from `pairings_cache` when prefs are empty or yield no cigar matches.
- Winston voice line in italic Playfair (uses the engine's single-rule fallback for now; see prose-cache note below). Brass "Open the pairing →" link drops into the existing `/pairings/[cigar]/[bourbon]` route.
- Moss border + "● club tried" eyebrow when the picked pair is club-validated.
- 11 new unit tests on the deterministic selector (162 total).

**Deferred from original scope:**
- Recent-activity weighting + Paul's tier signal aren't wired in v1 — pure preference-bias + club-validated fallback was the v1 cut.
- LLM-generated Winston prose: we still fall back to the engine's `reasons[0].reason` text on the hero (same generic line on the Pairings index too). Resolved by the new "pairing-prose cache" follow-up logged below.

**Followups (logged 2026-05-21):**
- **Pairing-prose cache.** Persist one LLM-generated Winston line per `(cigar_id, bourbon_id)` pair so the Daily Pour hero and the Pairings index can render real prose without burning an OpenAI call per page render. The `pairings_cache` table already has a `rationale_text` column — wire it. Generate on-demand the first time the pair is surfaced; subsequent renders read the cached line.

**Stickiness signal:** Daily opens. The marketing-style hook for a private app.

---

#### 4. Pick My Pour — on-demand pairing oracle (NEW 2026-05-23) — **✅ shipped 2026-05-23**

**As built:**
- `lib/pick-pour/` — cellar Have×Have intersection scoring via `pairings_cache` + engine fallback; widens with Want when pool is thin (< 3 pairs); falls back to Daily Pour candidate loader when cellar is empty or one-sided.
- FNV-1a selector keyed on `<memberId>|<date>|<rollIndex>` — **unlimited re-rolls** (no server-side cap).
- Server action `pickMyPour` → redirect to `/pairings/[cigarId]/[bourbonId]`.
- Entry points: ghost **"Pick from my cellar →"** below Daily Pour hero on For You tab; brass **"Pick for me →"** on own-profile Cellar tab when Have ≥ 1; Winston nudge when shelf is bare.

**Deferred:** Pairings index CTA.

**Stickiness signal:** Intent-driven daily session opener. Members who don't want to think get one tap to a decision.

---

### Tier 2 — Cigar-nerd / bourbon-collector depth

For members who want to nerd out beyond the chip-cloud face.

#### 4. Depth view with radar chart (Phase 4 enhancement) — **✅ partial 2026-05-21**

**As built (commit 3567227):**
- New `/products/[id]/depth` route showing a pure-SVG radar over the
  10 PAIRING_TRAITS (sweet, creamy, warm, sharp, woody, earthy,
  roasted, bright, dry, fruity). Reusing the existing axes — instead
  of the originally planned 8-axis cigar / bourbon-specific set —
  saved a derive layer and means every product with a `trait_vector`
  already has a shape to draw, with no new aggregation.
- `DepthAffordance` (previously a scaffold) now renders as a real
  brass Link when the product has a vector, and as a disabled
  Winston card when it doesn't.
- Header + back link + Winston voice line + footnote setting
  expectations for the layered passes.

**Followups (deliberate v1 cuts):**
- **Member adjustments.** Outlined attributable dots over the
  baseline shape. Needs the `product_adjustments` table (per-member,
  per-axis offset). Per-axis drag-to-adjust UI on top.
- **Club consensus shape.** Soft moss fill that's the average of all
  members' adjusted vectors. Only surfaces when N members have
  contributed.
- **Chip add/remove per member.** Part of "The Session" (Tier 1 #2)
  more than this surface — defer alignment with that work.
- **Free-text Session notes per phase.** Also Tier 1 #2 territory.
- **Custom 8-axis vocabulary** (Strength/Body/Spice/Finish/etc.). The
  10-trait axes hold up well for v1; revisit if members find the
  pairing-trait names too abstract on the radar face.

**Schema (deferred):** `products.editorial_baseline_profile jsonb`
isn't necessary while we're using `trait_vector` as the baseline.
`product_adjustments` lands with the member-adjustments followup.

**Locked invariant:** No 0–100 aggregate score, ever — even on the
deeper face.

---

#### 5b. Tabbed Feed — For You / Cigars / Bourbons / Favorites (NEW, 2026-05-21) — **✅ partial 2026-05-21**

**As built (commit 91e67f9):** three tabs ship — For You / Cigars /
Bourbons. URL-driven (`?tab=cigars`) so bookmarks and back/forward work.
Active tab gets a brass underline (matches the bottom-nav vocabulary).
Catalog tabs reuse a new `CatalogCard` over the photo-as-card primitive
with PhotoPlaceholder for catalog rows lacking member photos. Matches
float to the top of the catalog list (stable sort, preserves alpha order
within each bucket); empty preferences fall back to pure alpha. The page
subtitle adapts to the active tab ("Recent tastings", "The cigar shelf",
"The bourbon shelf"). Catalog limit: 100 rows per tab (paginator
deferred). FOR YOU pill from #5a lights identically on catalog cards.

**Deferred:** Favorites tab — the `favorites` table is still in Tier 3 #9
scope. Add the fourth tab when that lands.

Below preserved for historical scope reference:

The current Feed home is a single chronological list of member tastings.
Lovely when the club is active, sparse when it isn't. Inspired by
TikTok's For-You / Following pattern: turn the Feed into a tabbed
browsing surface so there's always something to look at, ranked by the
viewer's taste.

**Tabs (segmented selector under the page header):**

- **For You** — current behavior. NCCC tastings, newest first. The
  page lands here by default. Tasting cards continue to carry the
  match badge from #5a when applicable.
- **Cigars** — catalog browse. ~2,020 cigars from StickPicks + any
  member-contributed. Card layout reuses Feed photo-as-card; without a
  member photo the stylized PhotoPlaceholder carries the look.
- **Bourbons** — catalog browse, same shape.
- **Favorites** — products the member has hearted. Empty state with
  a Winston prompt to favorite something. Same products surface on
  the member profile per UX-5; this tab is just the home-page entry.

**Ranking inside Cigars / Bourbons tabs:**
- If preferences exist (#5), order by a simple match score:
  preference-matched products first (subtly tagged), then high-rated
  catalog entries, then random tail. Pairing-engine score is NOT
  used here — that's for cross-product matching, not browse ranking.
- If no preferences, fall back to randomized-with-recent-tastings-
  prioritized. Anything a club member has touched lately bubbles up.
- Cache the rank order per session so scrolling stays stable; refresh
  on pull-to-refresh or 1h TTL.

**Card behavior:**
- Tap → product detail page (existing route).
- Photo: member-contributed hero when present, else PhotoPlaceholder
  with the etched cigar/glencairn glyph.
- Match badge ("FOR YOU") top-right when the viewer's preferences
  match — same component from #5a.
- A small ember pip can mark products the viewer has personally
  recommended; a moss pip can mark products the club has validated
  via group-validated pairings. Both are subtle — the goal is
  glanceability without competing with the photo.

**Catalog-image gap (data dependency):**
We currently only have member-contributed photos. Catalog rows have no
default imagery. The Cigars / Bourbons tabs will mostly render
placeholders until a member captures each product. Three paths to
populate later:
1. Pull image URLs from the cigar-api / CigarBase RapidAPI endpoints
   we already integrated (CigarBase returns image_url on most rows).
2. Hand-curate a starter set tied to Tier 3 #12.
3. Accept stylized-placeholder-as-default; let real photos accrete
   via captures.

Option 3 is the design-system-honest answer — the etched-glyph
placeholder is intentional, not a hole. But (1) is cheap once
CigarBase's subscription gate is sorted.

**Scope cut for v1:**
- No infinite scroll — pagination by "Load more" button. Keeps the
  query budget honest for a 12-person Supabase free-tier.
- No filters beyond the tab itself. Brand / strength / style filters
  ride the Cellar work in Tier 1 #1.

**Schema:** none new. Reads from existing `products`, `tastings`,
`member_favorites` (#9), `member_preferences` (#5).

**Why Tier 2 not Tier 1:** the For-You tab already exists; the
catalog tabs are additive discovery surfaces, not load-bearing for
the core capture-and-recommend loop. Build #5 + #5a first so the
ranking has something to rank against.

---

#### 5a. Match badge on Feed cards (NEW, 2026-05-21) — **✅ shipped 2026-05-21**

**As built (commit 84bf5f5):** the FOR YOU pill lights at the top-LEFT
of feed cards (top-right was already claimed by the ember dot) when a
product matches the viewer's preferences. Etched-glass treatment
(low-opacity ink scrim, paper-50 border, 10px tracked-widest uppercase
"For you"). The badge gates on three conditions: viewer has at least
one preference set, the tasting belongs to someone else, and the
matcher fires on at least one axis. Match is computed server-side per
feed card (no client-side recomputation).

Below preserved for historical scope reference:

Direct partner to #5. Once a member has stored preferences, every feed
surface checks: does this product match what you tend toward? If yes,
show a small "for you" pill — subtle brass-tint, top-right of the feed
card, only present when the match is real.

**Scope:**
- Pure presentation layer on existing Feed + (later) Cellar / Pairings
  cards. No new tap-through; the badge is a glance signal, not a CTA.
- Matching logic v1 (pure functions in `lib/preferences/`):
  - For a bourbon product + viewer-bourbon-prefs: style_family ∈ pref.styles
    OR proof ∈ pref.proof_band → match.
  - For a cigar product + viewer-cigar-prefs: strength ∈ pref.strengths
    OR wrapper_color ∈ pref.wrappers → match.
  - One match suffices to light the badge. Don't try to score depth —
    binary keeps the surface uncluttered.
- Empty preferences → badge never lights (graceful zero-state for
  members who haven't opted in).
- The viewer's own tastings always count as matches by definition
  (they obviously liked it); skip the badge on your own cards to avoid
  noise.

**Voice:** copy on the badge is just "for you" in tracked-widest
all-caps. Winston doesn't speak through this surface — it's a
quiet hint, not a recommendation.

**Schema:** ties to the `member_preferences` table from #5. No new
tables.

**Stickiness signal:** members see their preferences validated as
the feed scrolls — small dopamine hits that reinforce the value of
filling out preferences in the first place. The loop: "I see 'for
you' on something I like → I trust the matcher → I update prefs to
get better matches → I see more 'for you' tags".

---

#### 5. Tasting + Pairing Preferences (Phase 5 enhancement → Profile) — **✅ shipped 2026-05-21**
**As built (commit c6a5dcc):**
- `member_preferences` table (one row per member, four `text[]` columns, RLS scoped to `auth.uid()`).
- `lib/preferences/` module: vocabularies, display labels, derive helpers
  (mash_bill → style, proof → band, wrapper → bucket), and a binary OR
  matcher. 31 unit tests cover the catalog's real-world messiness.
- **Cigar strength:** 5 buckets (mild / mild-medium / medium / medium-full / full).
- **Cigar wrapper:** 8 grouped buckets (Connecticut, Habano, Maduro/Broadleaf, San Andrés, Corojo, Sumatra, Cameroon, Oscuro) collapsing 20+ raw catalog values.
- **Bourbon style:** 6 derived tags (bourbon, rye, wheated, high-rye, bottled-in-bond, single-barrel). Derived from `whiskey_type` + `mash_bill` rather than the sparse `style_family` column — covers the full ~2,000-row catalog.
- **Bourbon proof:** 3 multi-select chip bands (≤90 / 90–110 / ≥110).
- Settings UI: a Preferences card sits between Appearance and Admin,
  opening with a Winston intro line. Single Save button + inline
  "Saved." confirmation. Server action whitelists each axis against its
  vocabulary before upsert.
- Positives-only: there is no avoid list. Empty preferences mean the
  Winston stays neutral — the #5a badge and #5b ranking both light up
  only when the member has opted in.

**Followups consumed elsewhere:** the planned "things to avoid" axis was
dropped per the 2026-05-21 lock. Pairing-engine personalization weights
mentioned in the original scope are not yet wired — the engine still
scores universally; preferences only drive #5a + #5b ranking today.

---

#### 6. CONSTRUCTION section on product detail (Idea 1.1) — **✅ shipped UX-3**
Wrapper / binder / filler / origin / vitola / strength (cigars) and
distillery / mashbill / proof / age / style family / DSP (bourbons) now
have their own labeled section above THE FACTS on the product detail
page. THE FACTS itself became a dense single-line info strip in the same
pass.

---

#### 18. Preference filter on Cigars / Bourbons catalog tabs (NEW 2026-05-23)
**Concept:** A "Show matches" toggle / filter chip in the Cigars and Bourbons catalog tabs that collapses the view to products matching the viewer's stored preferences. Currently the FOR YOU pill lights on matched cards but you still scroll the full 100-row list. This makes the filter actionable.

**Scope:**
- A `matched` filter chip (alongside the existing strength / wrapper / style / proof chips in `CatalogFilterControls`) that, when active, passes a `matchedOnly: true` flag to `loadCatalogBrowse` and the query adds a `WHERE` clause that pre-filters to preference-matched products.
- Empty state: if preferences aren't set, the chip is hidden with a Winston nudge ("Tell me what you like in Settings and I'll filter the shelf for you, sir.").
- Chip is mutually exclusive with other filter chips in the same axis (or can stack — bikeshed at implementation time).

**Schema:** none. Reads existing `member_preferences`. Pure query + UI layer.

**Effort:** small — 1–2 hours. Preferences + matching logic already exist; just need the filter path wired through `CatalogFilters` → `loadCatalogBrowse`.

---

#### 19. Bourbon editorial tasting notes (NEW 2026-05-23)
**Concept:** The bourbonExplorer seed data and Apify enrichment may include editorial tasting notes per product (e.g., "vanilla, oak, cherry, long finish" as a prose sentence, not just chips). If present, surface them on the product detail page in THE FACTS or a new TASTING NOTES strip — distinct from member-contributed chip clouds, labeled as editorial.

**Open question:** Need to audit the enrichment schema. Check `products.specs` for a `tasting_notes` or `description` key on enriched bourbon rows. If present at meaningful coverage (> ~30%), ship the display; if sparse, hold until enrichment catches up.

**Display rules (if shipped):**
- Shows only when `specs.tasting_notes` is non-null and non-empty.
- Labeled "DISTILLERY NOTES" or "EDITORIAL" to distinguish from THE CLUB SAYS chip cloud.
- Winston does NOT narrate this block — it's source data, not club opinion.
- No interaction (no voting, no editing on the face — depth-view territory).

**Effort:** small display work once data is confirmed present.

---

#### 20. Pairing engine — graceful fallback + top 2-3 surfacing (NEW 2026-05-23)
**Context:** Paul's observation: "we're getting pairings off of a huge catalog — maybe as our cellar entries grow could be good. Base it on vitola and flavor profile to give top 2-3 instead of some esoteric cigars."

**Three brainstormed improvements:**

**a) Top 2-3 pairs instead of a single result**
Currently the Pairs With panel on product detail shows one pairing (the highest scored). Showing 2–3 gives the member options and better communicates the pairing space. Carousel or stacked chip-list with the moss badge on the top hit.

**b) Vitola + flavor profile fallback**
When club activity is sparse (few members have tried a product), the pairing engine has weak signal and can surface obscure products. A vitola + trait-vector similarity fallback: if the top engine result scores below a threshold (e.g. < 60), swap to a similarity-based match — find cigars with the closest `trait_vector` to the bourbon (or vice versa) in a common vitola (Robusto / Toro) the club tends to buy. Fast, deterministic, explainable.

**c) Cellar-biased pairing**
As cellar grows, a natural enhancement: prefer pairing results where the member **Has** the other item (or wants it). "Winston suggests the Elijah Craig 18yr — you already have a bottle." This extends the existing `applyCellarBias` logic into the Pairs With rendering path, not just the Daily Pour.

**Implementation order:** (c) is the lowest lift — extend bias into Pairs With. Then (a) — query top-3 instead of top-1. Then (b) — the fallback path needs the similarity layer.

**Schema:** none new for (a) and (c). (b) may need a pre-computed `vitola_bucket` column or a derived filter in the query.

---

#### 21. Adjacent picks — "you might also like" (NEW 2026-05-23)
**Concept:** Alongside (or below) the pairing hero, surface 1–2 **same-category** recommendations. "You just tried the Perdomo Champagne — the club has also been reaching for the Rocky Patel Vintage '92." Cigar → similar cigar; bourbon → similar bourbon.

**Why this is different from pairings:** pairings are cross-category (cigar × bourbon). Adjacent picks are within-category — the recommendation for when a member isn't shopping for a full pairing, just wondering what to smoke next.

**Signal sources (in priority order):**
1. Trait-vector cosine similarity on `products.trait_vector` (already computed). Fast, no club data required.
2. "Members who tried X also recommended Y" — a `co_tasted` table derivable from existing `tastings` if enough members accumulate overlapping tastings.
3. Same distillery / same brand family (bourbon), same vitola + origin (cigar) as a fallback.

**Surfaces:**
- Product detail page: a compact "ALSO FROM THE SHELF" horizontal strip below Pairs With, showing 2 similar products.
- Could fold into the Daily Pour / Pairings page later: "Not feeling a full pairing? Here's a cigar you'd likely enjoy on its own."

**Effort:** medium. The trait-vector similarity query is a few lines of pgvector math (`<->` cosine operator) and a wrapper in `lib/feed/`. Display is a horizontal scroll of small product chips.

**Schema:** none new. Pure query over `products.trait_vector` + `tastings`.

---

#### 22. Price bucketing — $ / $$ / $$$ display (NEW 2026-05-23) — **✅ shipped 2026-05-23**

**As built:** `lib/catalog/normalize-specs.ts` coalesces `price_usd` / `msrp_usd`; cigars map StickPicks `price_tier` 1–5 → `$`…`$$$$` (dollar fields override). Bourbons bucket only when a price exists (~14% today). Muted bucket on product detail subtitle + depth Facts strip. No catalog filter chip yet (bourbon coverage too thin).

---

#### 23. Multi-angle capture retry (NEW 2026-05-23)
**Concept:** When the AI vision pass on a captured photo returns a low-confidence match (or no match), instead of dropping the member into a manual search, offer a "Take another angle" retry path. Cigars are tricky from the band alone — a shot of the box, the foot, or the whole stick can resolve ambiguity.

**Flow:**
1. First capture → vision match runs → confidence below threshold (or "Not quite right?" is tapped).
2. Instead of just showing the edit form, offer: "Let me see another angle — try the box, the label, or the foot."
3. Member takes a second (or third) photo. All N captures are passed together to the vision call (`content: [{ type: "image_url", ... }, { type: "image_url", ... }]` — GPT-5 mini vision accepts multiple images in a single message).
4. Multi-image pass typically resolves what single-image misses. If still no match, fall through to manual search.

**Why this matters:** the single biggest friction point in the capture flow is a misidentification. Multi-angle retry is cheaper than any other fallback (no extra UI, same API, same pipeline), and the GPT-5 mini vision model handles multi-image context well.

**Effort:** medium. Capture flow (currently a single photo) needs a "retry" state. The server action that calls the vision API needs to accept an array of image URLs. The matching logic is unchanged.

---

#### 24. Rarity tiers — common / uncommon / rare (NEW 2026-05-23)
**Concept:** Tag each product with a rarity tier: **Common** (widely available at retail), **Uncommon** (allocated, seasonal, or limited distribution), **Rare** (allocated lottery / secondary-market only / vintage).

**Why:** helps pairing (a Rare × Rare pairing should carry different weight than Rare × Common), helps Daily Pour (can lean toward what members are likely to own), and adds collector texture to product detail pages.

**Sources for bourbon:**
- `tier_seed` from Paul's xlsx (already in `products.specs` — 5-tier ranking from 1–5). Map to rarity bucket: tier 1–2 → Common, tier 3 → Uncommon, tier 4–5 → Rare.
- For unenriched rows: derive from `proof` + `age_years` heuristic as fallback (high-proof + long-age → Uncommon or Rare).

**Sources for cigars:**
- No direct equivalent to tier_seed. Options: (a) manual curation for the top 50 NCCC staples, (b) LLM-assisted tagging during enrichment pass, (c) infer from production-run size signals if CigarBase exposes them.

**Display:** a small badge or inline text on product detail in the CONSTRUCTION section. Not on feed cards (too noisy). Potentially a catalog filter chip ("Show rare only").

**Pairing engine hook:** add a rarity-match bonus to the pairing score — Rare × Rare gets +5 (the "special night" signal), Rare × Common gets no bonus/penalty.

**Effort:** medium — bourbon side is mostly data plumbing from existing fields. Cigar side needs an enrichment or manual pass.

---

#### 25. Cellar privacy toggle (NEW 2026-05-23)
**Concept:** Let each member choose whether their Cellar is visible to other club members. Default: visible (the social discovery value is high in a 12-person private app). Toggle lives in the YOU → Settings page.

**Scope:**
- Add `cellar_public boolean DEFAULT true` to `users` (or `member_preferences`) table.
- The member profile page (`/members/[id]`) checks this flag: if the viewer is not the owner and the owner's cellar is private, the Cellar tab is hidden (or shows a Winston "This member keeps their shelf private, sir.").
- The toggle itself: a simple on/off in the YOU page under a "Privacy" section. Server action to update.
- The owner always sees their own cellar regardless of the flag.

**Effort:** small — one DB column, one server action, one conditional on the member profile page.

---

### Tier 3 — Polish and refinements

Lower-stakes improvements. Ship as bandwidth allows.

#### 7. Rename "Feed" → "The Lounge" (Idea 3.3)
Trivial. Better voice match. ~10 minutes.

#### 8. Pairing screen redesign per Idea 2.2
Two-card stacked layout, status badge (THE CLUB AGREES / WINSTON SUGGESTS), "Try this tonight" → adds to next Session, "Suggest another" rotates the bourbon.

#### 9. You-page expansion — Favorites + History + (preferences land Tier 2)
**Scope (sharpened 2026-05-21 from smoke-test feedback):**
- **Favorites:** members heart cigars + bourbons they want to remember
  (distinct from "Recommended to NCCC" — favorites are aspirational, an
  Amazon-list, not a tasting record). Shown as a compact gallery on the
  You page below the hero.
- **Contribution history (compact):** chronological strip on the You page
  showing recent recommends + meetups + photos contributed. Glanceable;
  taps drill into the full /members/[id] view.
- Pairing/tasting Preferences land alongside these in the same You section
  (Tier 2 #5).
- Format: Paul-C hero on top (avatar + name + email + role + member-since),
  then Appearance toggle (✅ shipped 2026-05-21), then Favorites strip,
  then History, then Preferences, then Club / Admin / Account sections.

#### 10. Winston illustration variants — **✅ shipped 2026-05-22**
Splash, header bust, glass-offering roundel, active-pour, and library variants on disk at `apps/web/public/winston/`. Single `<Winston variant=… />` component (`apps/web/src/components/brand/winston.tsx`) renders each surface from the locked filename map.

**Character rename (locked 2026-05-22):** the working title "The Bartender" is retired. The character's name is **Winston**. Voice rules unchanged — still serif italic via `<Voice />`, still gentlemanly-dry. He just has a name now.

**Surface assignments (locked 2026-05-22, illustrations on disk at `apps/web/public/winston/`):**

| Variant | File | Surfaces |
|---|---|---|
| Splash / full-figure | `winston-splash.png` | `/login`, `/accept-invite`, end-of-night recap (`/events/[id]/recap`) |
| Header bust | `winston-bust.png` | Empty states (Cellar, Favorites, History, Pairings, quiet Lounge), header avatar where Winston is named |
| Small glass-offering (roundel) | `winston-glass.png` | Inline ornament above `PAIRS WITH` divider; small "Winston says" callouts |
| Daily Pour active | `winston-pour.png` | Daily Pour hero card (Tier 1 #3) accent |
| Library + owl-Archivist (narrative) | `winston-library.png` | First-run onboarding screen (#17 below); reserved for Education library headers later (Tier 3 #14) |

**Out of scope for v1:** the owl character in `winston-library.png` is not yet a committed second mascot. He rides along on the onboarding image but doesn't appear elsewhere. If the club takes to him, formalize him later (working name: the Archivist).

**Surfaces that intentionally do NOT get a Winston illustration** (per design system §6): capture screen, Lounge/feed cards themselves, product detail face.

#### 11. UPC barcode scanner (Idea 2.3)
`@zxing/browser` on the capture sheet, bourbon only. Cigars don't have UPCs.

#### 12. Hand-curated cigar editorial baseline (~100–150)
Pair with the Halfwheel RSS path: pull editorial reference data for the brands NCCC actually smokes. Generate baseline radar profiles via gpt-5-mini, Paul approves.

**Smoke-test 2026-05-21 audit — known gaps in the current ~2,020-row StickPicks seed.** Of 24 spot-checked staples, 13 returned zero matches; another 3 returned one. Confirmed-missing club staples to add first:
- **Padron 1964 / 1926 / Family Reserve** (entire flagship line absent)
- **Liga Privada No. 9 and T52** (only sub-line `H99 Churrasco` is present)
- **My Father Le Bijou 1922**
- **Davidoff Nicaragua**
- **Tatuaje Black**
- **Oliva Melanio** (Serie V present, single SKU only)
- **La Aroma de Cuba Mi Amor**
- **Aging Room Quattro**
- **Diesel Whiskey Row**
- **Ashton VSG**
- **Nica Rustica** — promoted from a draft via in-session backfill; needs a real seed entry so future re-seeds don't drift.
The audit also found Fuente Opus X, Hemingway Short Story, and Oliva Serie V at one SKU each — likely a single representative vitola rather than the full line.

#### 13. Schema first-class fields
Promote `style_family`, `tier_seed`, `dsp_code`, `mash_bill` from inside `products.specs` (jsonb) to dedicated columns. Enables better indexing + filter UIs.

#### 14. Education content library
Winston-voiced articles: glossary, "what are thirds?", "what's a mashbill?", pairing fundamentals.

#### 15. Member badges & micro-badges (NEW, 2026-05-21 smoke-test feedback)
**Scope:**
- Members page currently reads as a thin roster — needs visual texture
  once everyone's on. Add light gamification surfaces.
- **Micro-badges:** small earned achievements rendered as little marks
  next to a member's name on the Members page + their /members/[id]
  profile. Examples to seed:
  - **First Light** — first tasting recommended to NCCC
  - **First Pour** — first bourbon tasting
  - **First Smoke** — first cigar tasting
  - **Tenth Contribution** — milestone count
  - **Founder** — joined within the first 30 days
  - **Host** — hosted a meetup
  - **Validator** — first pairing the club later validates
  - **Winston's Choice** — a tasting Winston quotes in a Daily Pour
- Implementation: derive from existing `tastings` / `events` data — no
  new schema needed for the seed set. A `member_badges` table later for
  ones that aren't trivially derivable.
- Voice + style match the design system — moss / brass / ember accents
  reserved per their existing rules; new badge colors stay subdued.
- **Out of scope intentionally:** leaderboards, scores, public rankings.
  Badges are flavor, not competition. They surface what someone has
  contributed; they don't rank members against each other.

#### 17. First-run onboarding sequence — **✅ shipped 2026-05-25**

A 3-step first-run flow at `/welcome`, gated by `users.onboarding_completed_at`. Reached after accept-invite (both auth paths). Spec: `docs/superpowers/specs/2026-05-25-first-run-onboarding-design.md`.

**As built:**
- Step 1 — Meet Winston (`winston-library.png`, personalized `<Voice />`).
- Step 2 — How NCCC works (snap/recommend, club voice, Cellar + preferences).
- Step 3 — Nav map (Lounge / Capture / Members / Pairings / You) + three exit CTAs: Capture, Preferences (`/you/settings#preferences`), Explore lounge.
- `(shell)` layout redirects incomplete members to `/welcome`; welcome runs without bottom nav.
- Auth fix: immediate signup (Case A) now routes to `/welcome` alongside email-confirm callback.
- Backfill migration sets `onboarding_completed_at = joined_at` for existing members.

**Out of scope:** preference capture on welcome, overlay tours, in-app replay.

#### 16. ~~Center-FAB nav redesign~~ — **✅ shipped UX-2**
Bottom nav now has the four-tab + center-FAB shape. Brass Capture FAB
floats above the bar, side tabs use Lucide outline icons + brass
underline for active state. Done.

#### 26. Collection breakdown (NEW 2026-05-23)
A visual analytics surface for a member's cellar. "Here's your shelf, sliced."

**Possible cuts:**
- **By flavor profile:** pie or bar chart of the dominant trait vectors across Have items — "your shelf leans woody + warm."
- **By price tier:** distribution of $ / $$ / $$$ / $$$$ in your cellar (requires price bucketing from Tier 2 #22).
- **By distillery / brand family:** how many Buffalo Trace vs. Heaven Hill vs. Jim Beam bottles.
- **By vitola:** Robusto-heavy vs. Toro-heavy vs. varied.
- **By rarity tier:** how many Common vs. Uncommon vs. Rare items (requires Tier 2 #24).

**Where it lives:** a "Stats" or "Breakdown" section at the bottom of the member's own Cellar tab. Hidden for members with fewer than 5 cellar items (too sparse to be interesting).

**Design constraint:** no 0–100 scores, no leaderboards. This is self-facing insight, not competitive ranking. Winston can narrate a single summary line ("Your shelf is heavily peated and mostly in the $$ range, sir — perhaps time for something rare.").

**Effort:** medium — mostly aggregation queries + a chart component. Blocked on #22 (price) and #24 (rarity) if you want those dimensions; flavor + distillery cuts can ship from existing data.

---

## Member-facing roadmap (plain English, for sharing with the club)

This is the version you can paste into the NCCC group chat or share when a member asks "what's next?"

---

> **NCCC is live and we're starting to use it.** Winston has the bourbon shelf cataloged, the cigar lounge is open, and the pairing engine is reading the room. Here's the path forward.
>
> **What you can do today:**
> - Snap a cigar band or bourbon label, tap **Recommend to NCCC**, optionally add a few flavor words.
> - Browse what the rest of the club has been smoking and pouring.
> - Tap a product to see the group's collective voice: who recommends it, what flavors keep coming up, what bourbon pairs with that cigar.
> - At meetups, tag your tastings to the night and see the screenshot-friendly recap card after.
>
> **Coming up — in roughly this order:**
> 1. **The Cellar** — a place for your bourbon shelf and humidor inventory. Bottle levels, cigar counts, what you've already finished. Add bottles straight from the capture screen.
> 2. **The Session** — when you light a cigar, you taste through First / Second / Final Third. Bourbon has Nose / Palate / Finish. The app will honor the ritual instead of asking you to summarize it in one chip-list.
> 3. **The Daily Pour** — Winston's nightly suggestion. One cigar, one bourbon, narrated. A reason to open the app any evening.
> 4. **Going deeper on every product** — tap any cigar or bourbon to see a flavor radar with the editorial baseline, every member's personal adjustments, and the club's consensus shape laid on top. No scores. Just the shape.
> 5. **Knowing what you like** — a Pairing Preferences setting that tunes Winston's recommendations to your tastes.
>
> **Send feedback to Paul.** This is a hobby project for us — what you ask for is what gets built next.

---

## Guiding design principle — "Clean face, layered depth"

Decided together (Paul + the roadmap conversation). This principle resolves the tension between NCCC's stated minimalism and the desire for cigar-nerd / bourbon-collector depth.

**Three layers per product:**

1. **Editorial layer** — curated reference data per product: construction (wrapper / binder / filler for cigars; mashbill / proof / age / distillery for bourbons), baseline tasting profile, canonical flavor descriptors. We author or source this. Seeded lazily on first recognition or eagerly for a starter set.
2. **Member layer** — each member's individual annotations on top of the editorial baseline: adjusted strength, adjusted flavor descriptors, free-text Session notes per phase. A member's adjustments are attributable to them and visible to the club.
3. **Club aggregate** — derived signal from the member layer: chip frequencies, consensus shape, "what the club tastes." This is what Winston narrates on the face.

**What lives where:**

- **The face** (home, Lounge feed, capture flow, feed cards): club aggregate only, Winston-voiced, chip-based. No scores, no sliders, no charts.
- **The depth** (tap into a stored or recognized product): editorial baseline + every member's adjustments overlaid + your own row for editing. Radar charts and per-field adjustments live here. Still no aggregated 0–100 score — adjustments are per-field, never collapsed into a single number that ranks products.

**Seed strategy (decided, partially shipped):** proactive seeding. Paul's whiskey collection xlsx is the bourbon authority (98 bottles, 41 descriptors, 6 style families). Cigar editorial baseline still needs hand-curation of ~100–150 brands NCCC actually smokes — defer to Tier 3.

---

## Inspiration sources

### 1. Capa (cigar app)

Reviewed: product detail page, tasting profile screen, smoke session flow.

#### Idea 1.1 — Construction reference data on the product page
**What Capa does:** Lists Wrapper (e.g. Brazilian Mata Fina), Binder, Filler origin under a CONSTRUCTION header. Flavor descriptors as chips (Dark Chocolate, Earth, Sweet Spice, Espresso).

**NCCC translation:** Add a CONSTRUCTION section to the product detail page. Pull from a reference dataset (curated or sourced). For bourbons, the analogous section is mashbill / proof / age / distillery. Flavor chips remain aggregate club-derived chips, not editorial.

**Status:** Tier 2 (item #6 above). Data already in `products.specs`; needs layout work only.

---

#### Idea 1.2 — Tasting profile visualization
**What Capa does:** Spider/radar chart with 8 axes (Strength, Body, Complexity, Sweetness, Spice, Finish, Creaminess, Earthiness) scored 0–10.

**NCCC translation (decided):** Lives in the **depth view** of a product page, never on the face. Three visual layers on the same chart:
- Editorial baseline shape (curated source-of-truth).
- Each member's adjustments as outlined overlay dots, attributable.
- Club consensus shape as a soft moss fill (the aggregate of member adjustments).

Axes derived from the flavor-wheel taxonomy. Numeric axis labels stay (0–10) because this IS the depth — the place where precision is welcome. The face still sees only chip clouds.

**Status:** Tier 2 (item #4).

---

#### Idea 1.3 — Smoke Session (timer + thirds)
**What Capa does:** Start a session → timer runs → tabs for First Third / Second Third / Final Third. Per-third inputs: strength scale + flavor note chips.

**NCCC translation:**
- Rename to **"The Session"** (Winston-ish, generic across cigar + bourbon).
- Cigar: First / Second / Final Third.
- Bourbon: Nose / Palate / Finish.
- Per-phase input is **chips only**.
- Timer is optional and ambient, not gating.
- Winston help link explains the ritual.
- Finishing a Session is the natural moment to tap **Recommend to NCCC**.

**Status:** Tier 1 (item #2 above). Marquee feature.

---

#### Idea 1.4 — Detailed adjustments (reframed from "power-user scoring")
**NCCC translation (decided per "Clean face, layered depth"):** No aggregated 0–100 score. Inside the depth view, each member can adjust individual editorial fields (strength axis, tasting-profile axes, chips, free-text Session notes per phase). Adjustments are attributable. The club aggregate shape (moss-filled) is derived from all members' adjustments combined. None of this surfaces on the face.

**Status:** Tier 2, lives inside the depth view (item #4).

---

### 2. Whiskey + cigar pairing app _(name TBD)_

Reviewed: profile/settings page, barcode scanner upsell screen.

#### Idea 2.1 — Profile page structure
**NCCC translation:** Avatar + `formatMemberName` + email. **No account tier card** — NCCC is private. Sections: **Pairing Preferences**, **Favorites**, **History**, **Education**.

**Status:** Tier 2 + 3. Pairing Preferences is item #5 (Tier 2); Favorites + History + Education is item #9 (Tier 3). Settings page (sign-out, admin links) already shipped in Phase 7.

---

#### Idea 2.2 — Pairing presentation
**NCCC translation (initial design):** Two-card stacked layout (cigar above bourbon), Winston intro line, `PAIRS WITH` etched divider between, status badge (`THE CLUB AGREES` moss / `WINSTON SUGGESTS` brass-subdued), why-it-pairs prose, brass primary `Try this tonight`, secondary `Suggest another`.

Entry points: from product page, from Daily Pour hero, from Lounge cards with club-validated pairings.

**Status:** Tier 3 (item #8). Existing `/pairings/[cigarId]/[bourbonId]` page works but uses a simpler layout. Redesign when bandwidth allows.

---

#### Idea 2.3 — Barcode / UPC scanner
**NCCC translation:** "Scan barcode" alternate input on the capture sheet. Bourbon only (cigar bands have no barcodes). Never premium-gated. Both inputs converge on the same product-recognition pipeline.

**Status:** Tier 3 (item #11).

---

### 3. Cigarbase

Reviewed: For You feed, My Humidor empty state, home page with Cigar of the Day + Featured Lounge.

#### Idea 3.1 — The Humidor (personal inventory)
**NCCC translation:** **My Cellar** as a primary tab. Two views: **On Hand** and **Finished**. Bourbon bottle level state. Cigar count + format. Add via camera capture (same pipeline as Recommend). Winston empty state. Overlaps with Profile/Favorites — cleanest model: Cellar replaces both Favorites (inventory + state) and parts of History; Favorites becomes a saved-products list (things you want, not things you own).

**Status:** Tier 1 (item #1 above). Phase 5.5 — biggest collector value-add.

---

#### Idea 3.2 — Cigar of the Day → "Tonight's Pour"
**NCCC translation:** Home-page hero card. **Always rooted in club activity** — never editorial / algorithmic-only. Source blend: member activity in last 24h + pairing-engine top result + Paul's tier signal. Moss-accented when club-validated. Winston narrates the why.

**Status:** Tier 1 (item #3). The marquee daily-hook feature.

---

#### Idea 3.3 — The Lounge (community surface)
**NCCC translation:** Rename the feed from "Feed" to **"The Lounge"**. Better voice match. Physical-lounge directory variant doesn't transfer.

**Status:** Tier 3 (item #7). Trivial rename.

---

#### Idea 3.4 — Bottom nav shape (5 items with center scan FAB)
**NCCC translation:** Adopt the 5-item shape with a center FAB. NCCC's center FAB is **Capture** (brass-accented). Five tabs: **Home / Cellar / Capture / Lounge / Profile**.

**Status:** Partial — 5-tab nav already shipped (Feed / Capture / Members / Meetups / You). The center-FAB visual elevation + the Cellar/Lounge rename are Tier 1+3.

---

#### Idea 3.5 — Feed post anatomy
**NCCC translation:** Member chip with `formatMemberName` + initials avatar, no badge tiers. Ember "Recommend" icon when lit (replaces Cigarbase's flame). No star rating on cards. Interaction bar: ember + comment only (no bookmark, no thumb, no external share).

**Status:** ✅ Mostly shipped in Phase 5 feed work. Comment thread on tastings is not yet built — Tier 3.

---

#### Idea 3.6 — Pairings presentation _(awaiting screenshot)_
**Status:** Open. Paul mentioned liking how Cigarbase presents pairings; screenshot not yet captured.

---

### 4. _(slot left open for future inspiration)_

---

## Editorial seeding strategy (decided, mostly shipped)

### Bourbon side ✅

`Cobb_Whiskey_Collection_Updated.xlsx` is the bourbon seed source. 98 bottles cataloged with: Distiller, DSP code, Brand, Expression, Type, Age, Proof, Mash Bill, Tasting Notes. 6 style families (`BWH / BST / BHR / RYE / BLD / SMW`). 5-tier ranking + Maker's Mark Wall.

**Status:**
- ✅ `seed-cobb-whiskey.ts` script written and committed.
- ✅ Bourbon wheel synonym index expanded (v0.1-syn1) to absorb the 41-descriptor vocabulary from the collection (Spice, Fruity, Peppery, etc. all now map).
- 🟡 **Not yet run** against production DB. Pre-launch checklist item #2.
- ❌ Schema first-class fields (`style_family`, `tier_seed`, `dsp_code`) — deferred to Tier 3 (item #13). Currently stored in `products.specs` jsonb.

### Cigar side 🟡

- ✅ ~2,020 cigars seeded via StickPicks JSON catalog (LLM-generated upstream, flavor tags map to wheel via synonym index).
- ✅ Halfwheel RSS + cigar-api + CigarBase seeders built as enrichment paths.
- ❌ Hand-curated ~100–150 cigar starter set for the brands NCCC smokes — Tier 3 (item #12).

### Schema implications (post-launch enhancement)

- ❌ `products.editorial_baseline_profile jsonb` — 8-axis radar values.
- ❌ `product_adjustments` table — per-member per-axis adjustments.
- ❌ `product_member_chips` table — chip adds/removes per member per product.

All three blocked on Tier 2 depth-view work (item #4).

---

## Sequencing — mapping ideas to implementation phases

Updated to reflect current `main` status. ✅ shipped, 🟡 partial, ❌ not shipped.

### Phase 0 — Foundation ✅
Shipped.

### Phase 1 — Catalog seeding 🟡
- ✅ bourbonExplorer JSON (1,350 rated bourbons).
- ✅ StickPicks JSON (2,020 cigars with flavor tags).
- ✅ Halfwheel RSS, CigarBase, cigar-api seeders.
- ✅ Wheel JSONs versioned and loaded into `flavor_wheels` table.
- 🟡 Paul's xlsx import — script ready, not yet run.
- ❌ Schema extensions (`style_family`, `tier_seed`, `dsp_code`, `editorial_baseline_profile`, `product_adjustments`, `product_member_chips`).

### Phase 2 — Capture & identify 🟡
- ✅ Camera capture, photo upload, GPT-5 mini vision, fuzzy match, draft create, reveal screen, "Not quite right? Edit" link wired to Phase 7 edit screen.
- ❌ UPC barcode scanner.

### Phase 3 — Tasting flow 🟡
- ✅ Recommend-to-NCCC with chips + note + silent wheel mapper.
- ✅ The Session v1 (optional `/products/[id]/session`, thirds / nose-palate-finish, Winston help, finish → Recommend + Add to Cellar). Quick Recommend remains default.
- ❌ Ambient session timer.

### Phase 4 — Product detail 🟡
- ✅ Face: group voice (recommend bar, member takes), tag cloud, Pairs With (Phase 6 active), The Facts.
- ❌ Promoted CONSTRUCTION section.
- ❌ Depth view with radar chart + per-member adjustments + moss consensus.

### Phase 5 — Feed / Members / Events 🟡
- ✅ Feed (chronological tasting cards), Members roster + profile, Events list + detail + recap card.
- ✅ 5-tab bottom nav (Feed / Capture / Members / Meetups / You).
- ❌ Rename Feed → Lounge.
- ❌ Center-FAB nav visual elevation.
- ❌ Member profile sections: Pairing Preferences, Favorites, History, Education.

### Phase 5.5 — The Cellar ✅
- ✅ Lightweight v1 (`member_saves`, have/want/tried, Cellar tab, `/shelf` redirect, cellar bias in Daily Pour + Pick My Pour).
- ❌ Full phase: pour levels, finished/on-hand split, Paul's xlsx bulk import UI, dedicated nav tab.

### Phase 6 — Pairing engine 🟡
- ✅ 8 declarative rules, scoring (0–100, clamped, 50 baseline), engine over the catalog, group validation, Winston prose via gpt-5-mini cached in `pairings_cache`, dedicated `/pairings/[cigarId]/[bourbonId]` page, Pairs With wired into product detail.
- ❌ Two-card stacked layout per Idea 2.2.
- ❌ "Try this tonight" → adds both products to next Session.
- ❌ "Suggest another" rotation.

### Phase 7 — Polish, admin, Winston 🟡
- ✅ Settings page + sign-out, admin invite generation, product edit screen, NCCCLogo component reused across surfaces, end-of-night recap card at `/events/[id]/recap`.
- ❌ Winston illustration variants (splash, header bust, small-glass).
- ❌ Education content library.
- ❌ Depth-view admin (review member adjustments and accept into editorial baseline).

### Phase 8 — Daily Pour ✅
- ✅ Home-page hero, deterministic pick, preference + cellar bias, prose cache, moss badge.
- ✅ Pick My Pour (on-demand cellar pick, unlimited shuffle, Daily Pour + Cellar entry points).

### Phase 9+ — Deferred bonus ❌
- Cellar shelf-location import (Paul's Shelf Plan tiers, tall-bottle override, Maker's Mark Wall).
- Member-adjustment moderation tools.
- Education library content expansion.
- Pairing screen iteration based on real club usage.

---

## Dependencies / critical path

- **The Session v1 (Tier 1 #2)** ships without `product_adjustments` — phased data merges into existing `tastings` columns. Per-member axis adjustments + `product_member_chips` remain Tier 2 Depth view work.
- **The Cellar (Tier 1 #1)** depends only on the capture pipeline (already shipped) and Paul's xlsx import (pre-launch checklist). The lightweight v2 primitive (`member_saves` table, have/want booleans, `/shelf` route) ships first as part of UI Refresh v2; the full Phase 5.5 features layer on top.
- **Daily Pour (Tier 1 #3)** depends on the pairing engine (already shipped) and a few weeks of real member activity to have non-empty source data.
- **Pairing Preferences (Tier 2 #5)** feeds the pairing engine — engine already accepts personalization weights through `trait_vector` math; just needs UI + storage.

---

## Open questions

- **Pairing screen iteration:** Phase 6 shipped a functional layout; the Idea 2.2 redesign is queued at Tier 3. Decide based on member feedback whether the current screen needs replacing.
- **Cigar editorial baseline sourcing:** which ~100–150 to hand-curate? Probably the brands at NCCC meetups + Halfwheel's top-rated list. Needs a list from Paul.
- **Education library authorship:** Paul writes? gpt-5-mini drafts with Paul editing? Defer to when Education ships (Tier 3 #14).
- **Cigarbase pairings screenshot:** Paul mentioned liking how Cigarbase presents pairings; screenshot wasn't captured. Capture before Tier 3 #8 work.
- **Comment threads on tastings:** the feed-post anatomy idea kept ember + comment as the interaction bar. Comments aren't built yet. Tier 3 candidate.
- **Bourbon tasting notes coverage (Tier 2 #19):** audit whether `products.specs` has a `tasting_notes` or `description` key on enriched bourbon rows before building the display. Run: `SELECT count(*) FROM products WHERE type='bourbon' AND specs->>'tasting_notes' IS NOT NULL;` — if > ~200 rows, ship it; otherwise hold.
- **Adjacent picks signal source (Tier 2 #21):** the trait-vector cosine path is ready today (`pgvector` installed). The "co-tasted" path needs a few months of club usage to accumulate enough overlapping tastings to be meaningful. Ship vector similarity first; layer co-tasted signal once the data is there.
- **Bourbon tier enrichment (Tier 2 #24 prep):** Cobb xlsx covers ~101 rows via `specs.tier`. For the remaining ~2k bourbon catalog, run a dedicated **LLM-only pass** (gpt-5-nano batch: name + distillery + proof + age → rarity tier 1–5 or Common/Uncommon/Rare) rather than waiting on Apify review prose. Store as `specs.tier` with `specs.tier_source: 'cobb' | 'llm'`. Apify path remains useful for images + review text; tier is a separate cheap batch job. Paul spot-checks the club staples subset before pairing-engine rarity bonus ships.
- **Price normalization (Tier 2 #22):** **✅ shipped 2026-05-23** — `lib/catalog/normalize-specs.ts`. Cigars: StickPicks `price_tier` → $…$$$$ (782 rows); dollar fields override when present. Bourbons: opportunistic bucket from `price_usd` / `msrp_usd` only (~286 rows); hide when null. Shown on product detail subtitle + depth Facts strip.
- **Pick My Pour re-roll cap (Tier 1 #4):** **resolved 2026-05-23** — unlimited re-rolls with shuffle; no server-side counter.
