# Solo Fork Spec — Personal Humidor & Cellar

A single-user fork of NCCC. Same engine, no club. One person tracks their humidor
and cellar, logs what they smoke and pour, and gets rules-based recommendations and
pairings driven by their own taste — not a group's.

Working title: **the Cellar** (rename later; app constant, trivial to swap — same
posture as Winston's name in NCCC).

> **This is a clean separate-repo fork.** Copy NCCC, delete the club layer, keep the
> engine. The solo app does not inherit NCCC's ongoing changes and does not carry a
> `SOLO_MODE` flag — the club code is *removed*, not gated. This doc is the cut list.

---

## 1. The one-sentence concept

A private, single-user iPhone PWA where I photograph the cigars and bourbons I own or
try, keep a humidor + cellar inventory, and let a rules-based engine tell me what to
smoke next, what to buy next, and what to pour with what — all from my own palate.

---

## 2. Why the fork is mostly subtraction

The personal app already exists inside NCCC. Phase 8 ("Cellar utility") built the entire
individual layer, and it does not depend on the group:

- **Cellar / humidor** — `member_saves` with `have` / `want` / `tried` / `loved`
  (`lib/cellar/`, migrations `20260522000001`, `20260528000001`).
- **Personal taste engine** — `lib/taste/`: per-person taste vector, "Try Next"
  recommendations, want-list re-rank, shelf-aware pairings, palate mirror.
- **Preferences** — `member_preferences` (strengths, wrappers, styles, proof bands).
- **The `/you` hub** — cellar, tastings, pairings, settings.

So the fork keeps ~80% of the code and removes the scaffolding that assumes 12 people.

---

## 3. What carries over unchanged (the engine)

- **Capture & identify** — camera → CLIP embedding → Vision fallback → catalog match/create.
  `app/(app)/(shell)/capture/`, `lib/identify/`, `app/api/enrich-draft/`, `app/api/product-photo/`.
- **Flavor wheel** — `data/flavor-wheels/`, `lib/wheel/`. Still silent infrastructure,
  still no sliders, still surfaces only as aggregated tag clouds.
- **Catalog + seeding** — `products`, `product_images`, `product_reviews`, the seed
  scripts, `lib/catalog/`, catalog browse/filter.
- **Pairing engine** — `lib/pairing/` (traits → rules → score → engine). Pure rules,
  fully tested. Now *always* theoretical + shelf-aware; the group-validation overlay is
  removed (see §5).
- **Makers / distillery pages** — `makers` table, `lib/makers/`, `/makers`. House-style
  read from our own wheel data.
- **Preferences + taste engine** — `member_preferences`, all of `lib/taste/`, `lib/cellar/`.
- **Design system primitives** — `components/primitives/`, tokens, dot-grid canvas,
  etched dividers, Playfair/Inter, sepia photo treatment, PhotoFrame.

---

## 4. What gets cut (the club layer)

| Area | Files / tables | Disposition |
|---|---|---|
| Club feed home page | `app/(app)/(shell)/page.tsx` | Replace with Cellar as home (§6). |
| Members list & profiles | `app/(app)/(shell)/members/`, `components/members/` | Delete. |
| Events / meetups | `events` table, `admin/meetup`, meetup banners, `lib/meetup/` | Delete. |
| Group voice | `lib/aggregation/` (`group-voice.ts`, `club-says-prose.ts`), "THE CLUB SAYS" section on product detail | Delete (product detail reframed, §5). |
| Invites & roles | `invites` table, `/accept-invite`, `admin/invites`, `role` on users | Delete; single account (§7). |
| Suggestions | `suggestions` table, `admin/suggestions` | Delete (no one to suggest to). |
| Admin shell | `admin/` (catalog admin stays as personal edit, rest goes) | Trim to personal catalog correction only. |
| Multi-user onboarding | club framing in `/welcome` | Re-voice for one person (§8). |

`tastings` **stays** as the personal tasting journal, but loses its club role (§5).

---

## 5. What gets reframed (the judgment calls)

### 5.1 The "Recommend to NCCC" signal → `loved` / `tried`
The club's whole point was the binary `tastings.recommend`. Solo, it's redundant: the
Cellar's `loved` / `tried` **is** the personal signal, and the taste engine already reads
from it (`SIGNAL_WEIGHT`: tried ≈ weak, loved ≈ strong).

- Remove the binary recommend from the tasting flow and from `tastings`.
- A tasting becomes a **journal entry** (photo, chips, note, per-third depth) that also
  flips `tried=true` on the Cellar row. A "love" tap sets `loved`.
- `lib/cellar/types.ts` invariants already model this (`loved ⇒ tried`, `have ⇒ tried`).
  No new signal needed — decision **(2a)** confirmed.

### 5.2 Product detail — drop "THE CLUB SAYS," keep the rest
The destination screen loses group voice and keeps everything that's about the product
or about *me*:
- **Cut:** recommend bar ("6 of 8"), member takes, club-says prose.
- **Keep:** hero, title block, **HOW IT TASTES** (tag cloud now aggregates *my own*
  tastings of it), **PAIRS WITH**, **THE FACTS**.
- **Add:** my Cellar state on the product (have/want/tried/loved) surfaced inline, plus
  my own note history.

### 5.3 Pairing engine — theoretical + shelf, no group validation
- Remove the group-validated overlay and the `is_group_validated` promotion in
  `lib/pairing/` and `pairings_cache`.
- Promote **shelf-aware pairing** (Phase 8.3, "pour from what I own") to the default:
  a cigar's top pairing is the best bourbon *on my shelf*, falling back to catalog.

### 5.4 Winston — personal narrator
Winston stays (he's a tone, not a club feature), but every club reference is rewritten:
- "8 members recommend" → gone.
- "The club hasn't paired this" → *"You haven't tried this pairing yet."*
- Empty humidor, palate mirror, Try Next intros — all first-person-addressed.
- Voice lines are centralized (`lib/voice/`), so this is a contained copy pass.

### 5.5 The palette — `moss` and `ember` need new jobs
The design system gives each accent exactly one job, and two of those jobs were club-only:
- **`moss`** = "club-validated pairings only." No club → **retire it, or reassign** to a
  single new personal job. Recommendation: reassign `moss` to **"on your shelf right now"**
  — the shelf-aware pairing marker. It keeps the disciplined one-job-per-accent rule and
  gives the strongest personal signal its own color.
- **`ember`** = "lit recommend icons only." No club recommend → reassign `ember` to the
  **`loved`** affordance (the filled heart on the Cellar). This is already the direction
  Phase 8.0 leaned; make it official.
- **`brass`** unchanged: the single primary action per screen.

This §5.5 is small but load-bearing — it's what makes the fork feel *designed* rather
than like NCCC with the club parts deleted. Capture it in a short `docs/design-system.md`
diff in the new repo before building UI.

---

## 6. Home screen — the Cellar (decision 3a)

Landing surface is the humidor/cellar, not a feed:

- **Top:** Winston's one-line palate mirror (*"You lean sweet, woody, full-proof."*).
- **TRY NEXT** (etched divider) — 3 cigars + 3 bourbons from the taste engine, each with
  a one-line rationale. Already built (`lib/taste/`, `lib/find-next/`).
- **MY HUMIDOR / MY CELLAR** — `have` inventory, cigars and bourbons, tappable to product
  detail. Want-list below, re-ranked by palate fit (Phase 8.2).
- **Recently logged** — a compact personal tasting journal (the old feed, just me),
  reachable but secondary.

Bottom nav collapses to: **Cellar (home) · Capture · Catalog · You/Settings.**

---

## 7. Auth & data model — single account

Keep Supabase auth (so data is private and syncs across my devices) but strip the
multi-user machinery:

- One user row, seeded on first login. No invites, no roles, no `role` column.
- RLS simplifies to "the authenticated user owns everything." Keep RLS on — it's still
  the cheapest correct default — but the policies collapse to `auth.uid() = user_id`.
- `formatMemberName` / the two-Paul logic becomes irrelevant; identity display can drop
  to just a first name or be removed from surfaces entirely.
- Migrations: author a single new `00xx_solo_reset.sql` in the fork that drops
  `invites`, `events`, `suggestions`, `role`, and the group-voice bits, rather than
  editing the 30+ historical migrations. Squash later if desired.

---

## 8. Onboarding — one person, one time

`/welcome` keeps the 3-step leather-bound feel but re-voiced: no invite acceptance, no
"join the club." Step 1 name, step 2 set preferences (strengths/wrappers/styles/proof —
this is the taste-engine cold-start), step 3 first capture. Preferences-as-cold-start is
already wired (`lib/taste/` falls back to `member_preferences` when the taste vector is thin).

---

## 9. Non-goals (unchanged from NCCC, plus fork-specific)

- No sliders / star ratings / 1–100 scores in any user-facing UI. The wheel stays silent.
- No sharing, no feed of others, no public profiles, no social. (This is the whole point.)
- No multi-user, no invites, no roles.
- No group-validated pairings.
- No native app — PWA only.

---

## 10. Phased cutover plan

Each phase leaves the fork deployable. Order minimizes broken intermediate states.

### Phase F0 — Fork & boot (1 evening)
- New private repo from an NCCC copy. New Supabase + Vercel projects.
- App builds and deploys unchanged (still "NCCC" internally). Verify auth + capture work
  end-to-end before deleting anything. **Baseline green.**

### Phase F1 — Single-account collapse (1 evening)
- `00xx_solo_reset.sql`: drop `invites`, `events`, `suggestions`, `role`; simplify RLS to
  `auth.uid() = user_id`.
- Remove `/accept-invite`, `admin/invites`, invite/role code paths.
- Seed one user on first login. Re-voice `/welcome`.
- **DoD:** I sign in, land in the app, no club/invite surfaces remain.

### Phase F2 — Cut the club surfaces (1–2 evenings)
- Delete `members/`, `events`/`admin/meetup`, `suggestions`, meetup banners, `lib/meetup/`,
  `lib/aggregation/`.
- Replace `page.tsx` (feed) with the Cellar home (§6).
- **DoD:** Home is the Cellar; no dead links; typecheck + build clean.

### Phase F3 — Reframe the signal & product detail (1–2 evenings)
- Remove binary recommend from the tasting flow and `tastings`; a tasting flips `tried`.
- Product detail: cut THE CLUB SAYS; HOW IT TASTES aggregates my own tastings; surface my
  Cellar state + note history.
- **DoD:** Logging a cigar marks it tried; product page shows my voice, no club voice.

### Phase F4 — Pairing & palette reframe (1 evening)
- Remove group-validation overlay; make shelf-aware pairing the default.
- Reassign `moss` → "on your shelf," `ember` → `loved`. Update `docs/design-system.md`.
- **DoD:** A cigar's top pairing is a bottle I own; accents have their new single jobs.

### Phase F5 — Winston voice pass & polish (1 evening)
- Rewrite every club-referencing line in `lib/voice/`.
- Audit empty states, palate mirror, Try Next intros for first-person address.
- Lighthouse/PWA pass. Rename app constant from working title if decided.
- **DoD:** No copy anywhere implies a group. The app reads as *mine*.

**~6–8 evenings** end to end, because the hard parts (identify, wheel, pairing, taste,
cellar) are inherited working.

---

## 11. Open questions

- **Name.** "the Cellar," "Humidor," something else? App constant; decide before F5.
- **Keep tasting depth (flavor-by-thirds)?** It sharpens the taste vector and is pure
  personal utility — recommend keeping.
- **Keep makers pages?** Pure personal-exploration value, no club dependency — recommend
  keeping.
- **Historical migrations:** reset-migration now, squash to a clean baseline later — or
  squash immediately? Reset-now is lower risk.

---

## 12. Execution progress (on branch `claude/personal-humidor-cellar-fork-p4iz1h`)

Executed as verified, committed increments — build green, typecheck clean (one
pre-existing unrelated test-file error), 439 unit tests passing at each step.

**Done:**
- **F2a** — Cellar is the home screen; catalog browse moved to `/catalog` (cigar/bourbon
  tabs); club feed removed; nav → `[Cellar][Catalog][⊕][Pairings][You]`.
- **F2b** — Deleted `/members`, `/admin/meetup`, meetup feed cards, `lib/meetup`.
- **F3a** — Product detail: "THE CLUB SAYS" → "YOUR NOTES"; removed recommend bar +
  member takes; deleted `ClubVoice`/`RecommendBar`/`MemberTakes` (tag cloud already
  reflects only my tastings in a single-user DB).
- **F3b** — Tasting flow: "Recommend to NCCC / Just logging it" → one "Save tasting";
  product-detail action relabeled "Recommend" → "Log tasting".
- **F5a** — Winston/club voice pass on always-rendered copy (login, onboarding, empty
  states, makers, `/you`).

**Pending decisions (blocking the rest):**
- **F4b palette** — reassign `moss`/`ember` (spec rec: moss→shelf, ember→loved) vs.
  retire moss. *Not yet applied — awaiting sign-off.*
- **F1 single-account** — dropping `events`/`invites`/`suggestions` ripples into a
  Supabase not yet provisioned (event-querying code in badges etc. must go with it), and
  the reset migration can't be applied from here. *Deferred to infra setup.*

**Deviations from the plan above:**
- Group-validated pairings (F4a) are **not surgically removed** — they go dormant once
  `events` are gone (validation requires tasting both at one event), so the engine
  degrades to purely theoretical on its own.
- Recommended keeping the `role` column as a solo **owner flag** rather than removing it,
  to avoid a wide admin-gating ripple; the sole user is the owner/admin.
- The `NCCC` brand mark is intentionally left until the app **name** is decided (§11).

---

*v0.1 · 2026-07-02 · Fork spec. Decisions locked: separate repo (1a), loved/tried signal
(2a), Cellar home (3a).*
*v0.2 · 2026-07-03 · Added §12 execution progress. F2/F3/F5a shipped on-branch; F4b palette
and F1 single-account pending sign-off / infra.*
