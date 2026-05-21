# NCCC — Roadmap

A living catalog of ideas inspired by other apps, translated into NCCC's voice, then sequenced for build. **Phases 0–7 of `nccc-implementation-plan.md` are shipped on `main` as of 2026-05-20.** Everything below the "Current status" section is post-launch candidate scope, ranked by impact.

**Translation rules** (from `CLAUDE.md` + `design-system.md`):
- No 1–100 scores, star ratings, or user-facing sliders on the **face**.
- The flavor wheel is **silent infrastructure** — surface as aggregate tag clouds, never as input sliders.
- The Bartender is the system voice. Brass is the single primary action. Ember = lit recommend. Moss = club-validated pairing.
- Private to 12 members. No public feeds, no follower counts.

---

## Current status — 2026-05-20

What's actually on `main` vs. what was planned. ✅ = shipped, 🟡 = partial / base ships but enhancements pending, ❌ = not shipped.

| Phase | Status | Notes |
|---|---|---|
| 0 — Foundation | ✅ | Email+password auth, reset flow, design tokens, primitives, Supabase clients, `formatMemberName`, 5-tab nav |
| 1 — Catalog seeding | 🟡 | bourbonExplorer (1,350) + StickPicks (2,020) seeded. Halfwheel RSS, CigarBase, cigar-api seeders built. **Cobb whiskey collection seeder built but not yet run.** Schema enhancements (style_family, tier_seed, dsp_code, editorial_baseline_profile, product_adjustments) deferred. |
| 2 — Capture & identify | 🟡 | Camera + GPT-5 mini vision + fuzzy-match working end-to-end. UPC barcode scanner deferred. |
| 3 — Tasting flow | 🟡 | One-tap "Recommend to NCCC" with optional chips + note + silent wheel mapping. **"The Session" (thirds / nose-palate-finish) NOT shipped.** |
| 4 — Product detail | 🟡 | Face complete: group voice, recommend bar, member takes, tag cloud, Pairs With, Facts. **Depth view (radar + per-member adjustments + moss consensus) NOT shipped.** |
| 5 — Feed/Members/Events | 🟡 | All three pages + bottom nav. Still called "Feed" (not "Lounge"). Member profile lacks Pairing Preferences / Favorites / History / Education. |
| 5.5 — The Cellar | ❌ | Not started. |
| 6 — Pairing engine | 🟡 | 8 rules, scoring, group validation, Bartender prose, cache, dedicated `/pairings/[cigarId]/[bourbonId]` page, Pairs With wired into product detail. **Two-card stacked layout + "Try this tonight" + "Suggest another" rotation NOT shipped.** |
| 7 — Polish / admin | 🟡 | Settings + sign-out, admin invites, product edit, logo reuse, end-of-night recap card. Bartender illustration variants + Education library NOT shipped. |
| 8 — Daily Pour | ❌ | Not started. |

**Tests:** 87 unit tests passing on `main` (wheel math, pairing rules, scoring, name normalization, fallback mappers, group voice aggregation, identity).

**Catalog state:**
- Bourbons: ~1,350 from bourbonExplorer (rated)
- Cigars: ~2,020 from StickPicks (with wheel_vector seeded from flavor tags)
- Cigar wheel and bourbon wheel both got synonym expansions (v0.1-syn1) from real seed-pass findings
- Paul's 98-bottle whiskey collection ready to import (script committed; not yet run)

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

Agreed 2026-05-20 (Paul + Claude design conversation). The baseline app is shipped and functional, but several surfaces need a visual pass before we keep stacking features on top. Build in order — each step sets the visual vocabulary the next one inherits.

**Working principles for this pass:**
- iPhone-first. Test every change in mobile viewport before declaring done.
- Honor `docs/design-system.md`: brass = single primary action, ember = lit recommend, moss = club-validated pairing, etched dividers at section breaks, Bartender voice in italic Playfair.
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
- Bartender voice intro line (italic Playfair).
- CONSTRUCTION section (Tier 2 item #6 promoted here — data's already in `products.specs`).
- THE FACTS as a dense info-strip, not a stacked list (e.g. `Proof 100 · Age 7yr · Mashbill 51/39/10`).
- Pairs With panel — moss accent when club-validated.
- "Open the depth" tap-through scaffolded (radar chart itself is Tier 2 #4, but the affordance lands here).

#### UX-4. Capture flow — add wow factor
Currently a form. Should feel ceremonial — like a Polaroid being developed.

- Photo capture → animated sepia develop transition (1–2s, skippable).
- Chip selection as tactile press-and-hold pills, not checkboxes. Selected chips animate up with weight.
- Recommend-to-NCCC as the brass primary at bottom (already is, but elevate it).
- Bartender does NOT appear here (per design system — preserve).
- Optional: shutter haptic on capture (iOS PWA supports `navigator.vibrate` on some installs).

#### UX-5. You / Settings buildout — **needs clarification before building**
Paul wants the **You** section expanded to hold member preferences with flag/badge selections.

**Open questions for Paul:**
- What preferences? (Pairing Preferences from Tier 2 #5 is one — strength range, style families, avoids. What else?)
- "Flag or badge selections" — does this mean: (a) toggle preferences on/off with visible badges, (b) member achievement badges, or (c) flagging products as favorites/saved?
- Where does Meetups live within You? Sub-page or surfaced inline?
- Does Cellar (Tier 1 #1) land here or stay as its own tab when built?

**Decision needed before scoping UX-5.** Skip in build order until clarified — UX-1 → UX-2 → UX-3 → UX-4 can proceed in parallel branches.

---

## Post-launch roadmap, prioritized by impact

Ranked by what NCCC members will most notice / value after they're using the app daily. **Build these in tier order**, but each tier is parallelizable internally.

### Tier 1 — The next three features members will ask for

These are the post-launch features most likely to surface in member feedback within the first month.

#### 1. The Cellar (Phase 5.5)
**Why first:** Collectors track inventory religiously. The bourbon shelf and the humidor are real, physical things members care about. Once a member captures a bottle, "is this in my cellar?" is the next question.

**Scope:**
- New bottom-nav tab between Members and Meetups.
- Two views: **On Hand** and **Finished**.
- Bourbon: pour level state (`full / half / heel / empty`), pour count.
- Cigars: count + format/vitola.
- Add-to-Cellar is a path on the capture sheet (parallel to Recommend, not a separate flow).
- Onboarding hook: Paul's 98 bottles seed his Cellar on first login. Others start empty with a Bartender greeting.
- Filter: brand, style family, strength, recommended-to-NCCC.

**Stickiness signal:** Daily for active collectors.

---

#### 2. The Session — restructure the tasting flow (Phase 3 enhancement)
**Why second:** This is the cigar-nerd-respect feature. Cigars evolve across the smoke; bourbons across nose/palate/finish. A single "Recommend" tap doesn't honor that ritual. The Session does.

**Scope:**
- Rename the current "Recommend" flow to **The Session**.
- Cigar: tabs for **First Third / Second Third / Final Third**.
- Bourbon: tabs for **Nose / Palate / Finish**.
- Each phase accepts chips + optional free-text. No strength slider — strength derives from chip patterns.
- Optional ambient timer (not gating).
- Bartender help: *"What are thirds?"* / *"What's nose/palate/finish?"*
- End-of-Session moment is the natural place to tap **Recommend to NCCC**. Optional second action: **Add to Cellar**.

**Stickiness signal:** Members who care about the ritual will use The Session for every smoke. The data captured is also richer for the pairing engine.

---

#### 3. The Daily Pour (Phase 8 — NEW)
**Why third:** A reason to open the app on non-meetup nights. Currently there's no daily hook — the feed is empty if nobody logged anything yesterday.

**Scope:**
- Home-page hero card: a single rotating cigar + bourbon pairing for tonight, Bartender-narrated.
- Source signal blend:
  - Recent member activity (someone Recommended this in the last 24h).
  - Pairing-engine top result that's also club-validated.
  - Paul's tier signal (weight Tier 1–2 on weekends, workhorses weeknights).
- Moss accent when the suggestion is club-validated.
- Tap-through opens the pairing screen.

**Stickiness signal:** Daily opens. The marketing-style hook for a private app.

---

### Tier 2 — Cigar-nerd / bourbon-collector depth

For members who want to nerd out beyond the chip-cloud face.

#### 4. Depth view with radar chart (Phase 4 enhancement)
**Scope:**
- Tap-through from product detail into a deeper layer.
- 8-axis radar: Strength, Body, Sweetness, Spice, Finish, Earthiness, Creaminess, Complexity (cigars); equivalents for bourbon.
- Three overlaid layers:
  - Editorial baseline shape (curated 0–10 reference).
  - Each member's adjustments as outlined dots, attributable.
  - Club consensus shape as soft moss fill.
- Per-axis drag-to-adjust UI for the viewer's own dots.
- Chip add/remove per member.
- Free-text Session notes by member, per phase.
- **No 0–100 aggregate score, ever.**

**Schema:** `products.editorial_baseline_profile jsonb`, new `product_adjustments` table.

---

#### 5. Pairing Preferences (Phase 5 enhancement → Profile)
**Scope:**
- Settings page entry: "What you tend toward."
- Member sets strength range, favorite style families, things to avoid.
- Feeds the pairing engine as personalization weights.

---

#### 6. CONSTRUCTION section on product detail (Idea 1.1)
**Scope:**
- Promote wrapper/binder/filler/country (cigars) and mashbill/proof/age/distillery (bourbons) to their own labeled section on the product detail face, above THE FACTS.
- Pull from `products.specs` (already populated by the cigar and bourbon seeders).

**Effort:** Small (~30 min). The data's already there; this is just a layout addition.

---

### Tier 3 — Polish and refinements

Lower-stakes improvements. Ship as bandwidth allows.

#### 7. Rename "Feed" → "The Lounge" (Idea 3.3)
Trivial. Better voice match. ~10 minutes.

#### 8. Pairing screen redesign per Idea 2.2
Two-card stacked layout, status badge (THE CLUB AGREES / THE BARTENDER SUGGESTS), "Try this tonight" → adds to next Session, "Suggest another" rotates the bourbon.

#### 9. Member profile sections — Favorites + History + Education (Phase 5 enhancement)
Saved-products list (Favorites), chronological Sessions + recommends (History), Bartender library (Education).

#### 10. Bartender illustration variants
Splash, header bust, small-glass-only variants. Currently using one logo image for all surfaces — works but lacks the Bartender-as-character continuity the design system gestures at.

#### 11. UPC barcode scanner (Idea 2.3)
`@zxing/browser` on the capture sheet, bourbon only. Cigars don't have UPCs.

#### 12. Hand-curated cigar editorial baseline (~100–150)
Pair with the Halfwheel RSS path: pull editorial reference data for the brands NCCC actually smokes. Generate baseline radar profiles via gpt-5-mini, Paul approves.

#### 13. Schema first-class fields
Promote `style_family`, `tier_seed`, `dsp_code`, `mash_bill` from inside `products.specs` (jsonb) to dedicated columns. Enables better indexing + filter UIs.

#### 14. Education content library
Bartender-voiced articles: glossary, "what are thirds?", "what's a mashbill?", pairing fundamentals.

#### 15. Center-FAB nav redesign
Current 5-tab nav works; the brass-FAB center variant from Cigarbase is an iPhone ergonomics polish.

---

## Member-facing roadmap (plain English, for sharing with the club)

This is the version you can paste into the NCCC group chat or share when a member asks "what's next?"

---

> **NCCC is live and we're starting to use it.** The Bartender has the bourbon shelf cataloged, the cigar lounge is open, and the pairing engine is reading the room. Here's the path forward.
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
> 3. **The Daily Pour** — the Bartender's nightly suggestion. One cigar, one bourbon, narrated. A reason to open the app any evening.
> 4. **Going deeper on every product** — tap any cigar or bourbon to see a flavor radar with the editorial baseline, every member's personal adjustments, and the club's consensus shape laid on top. No scores. Just the shape.
> 5. **Knowing what you like** — a Pairing Preferences setting that tunes the Bartender's recommendations to your tastes.
>
> **Send feedback to Paul.** This is a hobby project for us — what you ask for is what gets built next.

---

## Guiding design principle — "Clean face, layered depth"

Decided together (Paul + the roadmap conversation). This principle resolves the tension between NCCC's stated minimalism and the desire for cigar-nerd / bourbon-collector depth.

**Three layers per product:**

1. **Editorial layer** — curated reference data per product: construction (wrapper / binder / filler for cigars; mashbill / proof / age / distillery for bourbons), baseline tasting profile, canonical flavor descriptors. We author or source this. Seeded lazily on first recognition or eagerly for a starter set.
2. **Member layer** — each member's individual annotations on top of the editorial baseline: adjusted strength, adjusted flavor descriptors, free-text Session notes per phase. A member's adjustments are attributable to them and visible to the club.
3. **Club aggregate** — derived signal from the member layer: chip frequencies, consensus shape, "what the club tastes." This is what the Bartender narrates on the face.

**What lives where:**

- **The face** (home, Lounge feed, capture flow, feed cards): club aggregate only, Bartender-voiced, chip-based. No scores, no sliders, no charts.
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
- Rename to **"The Session"** (Bartender-ish, generic across cigar + bourbon).
- Cigar: First / Second / Final Third.
- Bourbon: Nose / Palate / Finish.
- Per-phase input is **chips only**.
- Timer is optional and ambient, not gating.
- Bartender help link explains the ritual.
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
**NCCC translation (initial design):** Two-card stacked layout (cigar above bourbon), Bartender intro line, `PAIRS WITH` etched divider between, status badge (`THE CLUB AGREES` moss / `THE BARTENDER SUGGESTS` brass-subdued), why-it-pairs prose, brass primary `Try this tonight`, secondary `Suggest another`.

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
**NCCC translation:** **My Cellar** as a primary tab. Two views: **On Hand** and **Finished**. Bourbon bottle level state. Cigar count + format. Add via camera capture (same pipeline as Recommend). Bartender empty state. Overlaps with Profile/Favorites — cleanest model: Cellar replaces both Favorites (inventory + state) and parts of History; Favorites becomes a saved-products list (things you want, not things you own).

**Status:** Tier 1 (item #1 above). Phase 5.5 — biggest collector value-add.

---

#### Idea 3.2 — Cigar of the Day → "Tonight's Pour"
**NCCC translation:** Home-page hero card. **Always rooted in club activity** — never editorial / algorithmic-only. Source blend: member activity in last 24h + pairing-engine top result + Paul's tier signal. Moss-accented when club-validated. Bartender narrates the why.

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
- ❌ The Session (thirds / nose-palate-finish, ambient timer, Bartender help links).

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

### Phase 5.5 — The Cellar ❌
Not started. Tier 1 item.

### Phase 6 — Pairing engine 🟡
- ✅ 8 declarative rules, scoring (0–100, clamped, 50 baseline), engine over the catalog, group validation, Bartender prose via gpt-5-mini cached in `pairings_cache`, dedicated `/pairings/[cigarId]/[bourbonId]` page, Pairs With wired into product detail.
- ❌ Two-card stacked layout per Idea 2.2.
- ❌ "Try this tonight" → adds both products to next Session.
- ❌ "Suggest another" rotation.

### Phase 7 — Polish, admin, Bartender 🟡
- ✅ Settings page + sign-out, admin invite generation, product edit screen, NCCCLogo component reused across surfaces, end-of-night recap card at `/events/[id]/recap`.
- ❌ Bartender illustration variants (splash, header bust, small-glass).
- ❌ Education content library.
- ❌ Depth-view admin (review member adjustments and accept into editorial baseline).

### Phase 8 — Daily Pour ❌
Not started. Tier 1 item.

### Phase 9+ — Deferred bonus ❌
- Cellar shelf-location import (Paul's Shelf Plan tiers, tall-bottle override, Maker's Mark Wall).
- Member-adjustment moderation tools.
- Education library content expansion.
- Pairing screen iteration based on real club usage.

---

## Dependencies / critical path

- **The Session (Tier 1 #2) and the Depth view (Tier 2 #4) both need a new schema:** `product_adjustments` table for per-member per-axis adjustments, `product_member_chips` for chip add/removes. Build the schema once; both features consume it.
- **The Cellar (Tier 1 #1)** depends only on the capture pipeline (already shipped) and Paul's xlsx import (pre-launch checklist).
- **Daily Pour (Tier 1 #3)** depends on the pairing engine (already shipped) and a few weeks of real member activity to have non-empty source data.
- **Pairing Preferences (Tier 2 #5)** feeds the pairing engine — engine already accepts personalization weights through `trait_vector` math; just needs UI + storage.

---

## Open questions

- **Pairing screen iteration:** Phase 6 shipped a functional layout; the Idea 2.2 redesign is queued at Tier 3. Decide based on member feedback whether the current screen needs replacing.
- **Cigar editorial baseline sourcing:** which ~100–150 to hand-curate? Probably the brands at NCCC meetups + Halfwheel's top-rated list. Needs a list from Paul.
- **Education library authorship:** Paul writes? gpt-5-mini drafts with Paul editing? Defer to when Education ships (Tier 3 #14).
- **Cigarbase pairings screenshot:** Paul mentioned liking how Cigarbase presents pairings; screenshot wasn't captured. Capture before Tier 3 #8 work.
- **Comment threads on tastings:** the feed-post anatomy idea kept ember + comment as the interaction bar. Comments aren't built yet. Tier 3 candidate.
