# Bourbon Catalog Plan — clean spine + matching

*Status: proposal + working prototype. No schema or data changes applied yet.*

## The problem

Browsing a mainstream brand is a mess. Knob Creek is the canonical example — the
catalog holds 14 rows, every one stamped `brand = "Jim Beam Distillery"`, with
near-duplicates, store picks, and discontinued bottles all rendered as equal
siblings:

```
Knob Creek 12 year old, 50%
Knob Creek 12 year old Kentucky Straight Bourbon, 50%   ← duplicate
Knob Creek, 50%                                         ← = Small Batch
Knob Creek 9 year old Kentucky Straight Bourbon, 50%    ← = Small Batch
Knob Creek Single Barrel Reserve (No. 3403 / 3405)      ← store picks
Knob Creek 25th Anniversary… ×3, Quarter Oak, 2001 Batch 1   ← discontinued
```

Four structural failures, none fixed by importing more data:

1. **`brand` = distillery, not brand.** Hierarchy is only repaired for Buffalo
   Trace (`lib/catalog/line-brand.ts` — the sole `DISTILLERY_BUCKETS` member).
   Every other brand stays flat.
2. **No core-range concept.** The `specs.tier` field is *allocation rarity*
   (1–5), not "is this a standard shelf expression." A whole core lineup can be
   tier 1–2, so the tier filter can't separate core from one-offs.
3. **Duplicates + noisy names.** `, 50%` proof suffixes and "Kentucky Straight
   Bourbon" boilerplate; the same pour listed two or three times.
4. **Hierarchy lives in pipelines, not the schema.** `products` is flat
   (`name, brand, line, specs`); structure is re-derived at runtime by
   `line-brand.ts` / `expression-normalize.ts` / `collapse-groups.ts` plus ~20
   one-off `scripts/seed/*catalog*` scripts. Every brand needs hand-coded rules,
   and the pairing engine re-infers the same structure on each request.

## Source evaluation — why "download a cleaner one" doesn't work

Our current `BourbonData.csv` **is** bourbonExplorer (identical filename,
columns `Name, Price, Abv, Rating, Year_Made, Distillery, Mash_Bill,
Flavor_Profile, Aging Period`, ~1,350 rows, same Chris Reddish hand-curated +
GPT-4-enhanced provenance). It's already the cleanest bourbon-specific download.

| Source | Bourbon coverage | Shape | Verdict |
|---|---|---|---|
| Our catalog | ~1,350 | flat list | **= bourbonExplorer** |
| bourbonExplorer (Cred1747) | same file | same `BourbonData.csv` | identical to what we have |
| makispl whiskey CSV | **0 bourbon** (173 Scotch) | name/category/rating/price | dead |
| WhiskeyProject API | ~370, Scotch-leaning | flavor-frequency matrix | not a catalog |
| Meta-Critic (whiskyanalysis) | Scotch-weighted | ratings + clusters | violates no-scores; stale 2023 |
| ModernThirst mash bills | mainstream US | flat brand→mashbill web table, no export | mash-bill **reference** only |
| Whiskey Ontology (rdf-models) | schema only, **no data** | brand→collection→series→distillery | validates the model, ships no rows |

**The takeaway:** every public whiskey dataset is a flat list. None publishes a
normalized producer → brand → expression hierarchy or a core-range flag. That
structure is a *curation artifact*, not downloadable data — re-importing any set
reproduces the same flat mess. We already paid to enrich what we have
(wheel vectors, reviews, specs); volume isn't what's missing.

## The decision

Keep our enriched data. Author a clean **spine** (the hierarchy + core ranges)
and **match** existing rows onto it. The spine supplies identity; matching reuses
all prior enrichment. ModernThirst stays as a mash-bill validation reference.

## Prototype (built, runnable, no DB)

- `apps/web/scripts/seed/lib/brand-spine.ts` — the curation artifact, three layers:
  1. **Producers** — normalize messy `Distillery` strings to a parent.
  2. **Brand families** — `(distillery + name prefix) → consumer brand`. Handles
     the one-distillery-many-brands case (Buffalo Trace → Eagle Rare, Weller,
     Blanton's, Stagg…; Heaven Hill → Elijah Craig, Evan Williams, Larceny…).
  3. **Core ranges** — for ~17 priority shelf brands, the canonical lineup with
     `status` (core / limited / discontinued). Uncurated brands still resolve +
     group; they're just not claimed as core.
- `apps/web/scripts/seed/prototype-catalog-spine.ts` — generic engine: resolves
  every row, folds release/vintage/pick variants, carries enriched data forward,
  splits core vs long tail. Writes `data/catalog-spine-report.txt`.

Run: `pnpm tsx scripts/seed/prototype-catalog-spine.ts [brandFilter]`

### What it produces

Knob Creek, 14 messy rows → clean `Jim Beam › Knob Creek`:

```
CORE:   Small Batch (100pf, 9yr)   ← folded 2 rows
        Single Barrel Select (120pf) ← folded 3 rows incl. store picks
        12 Year (100pf)            ← folded 2 rows (dedup)
        15 Year · 18 Year [LIMITED]
        Rye / Rye Single Barrel    ← GAP: on spine, missing from catalog
LONG TAIL: 25th Anniversary, Quarter Oak, 2001 Batch  [DISCONTINUED]
```

Curated mainstream brands collapse dramatically and cleanly:
Buffalo Trace 45→3, Four Roses 34→6, Wild Turkey 22→6, Elijah Craig 30→4,
Eagle Rare 12→2, 1792 12→7, Maker's Mark 10→4.

### What it proves

1. Hierarchy is real (`producer / brand_family / expression`), not stamped with
   the distillery.
2. Dedup + release-collapse works (the two "12 Year" rows merge; store picks fold
   under Single Barrel Select).
3. Enrichment carries forward — mash bill, proof, price range, flavor union all
   come from existing rows. The spine adds identity, discards nothing.
4. The spine reveals **gaps** a flat list can't (Knob Creek Rye is core lineup,
   absent from the catalog).

### Known tuning items (overlay refinement, not blockers)

- Greedy fallback can absorb a vintage into the flagship (Knob Creek "2001 Batch"
  → Small Batch; Elijah Craig limited → Small Batch price $200). Add vintage-batch
  guards per overlay.
- Buffalo Trace Experimental Collection collapses 36→1 — arguably too aggressive.
- Auto-grouped batch brands (Booker's 30→30, Bardstown 33→33) don't collapse
  without a curated overlay — expected; these need overlays or a batch-release
  rule. This is precisely why curation, not download, is the lever.

## Production migration + backfill (built)

**Migration** `supabase/migrations/20260527000001_catalog_hierarchy.sql` adds
queryable columns to `products`: `producer`, `brand_family`, `expression`,
`release_label`, `is_core_range`, `discontinued`, `nas`, and `catalog_included`.
`catalog_included` defaults `true`, so applying the migration changes nothing
until the backfill runs (non-breaking).

**Shared classifier** `scripts/seed/lib/spine-match.ts` — single source of truth
used by both the dry-run prototype and the backfill (`classifyProduct` +
`planCutback`), so they can't drift.

**Backfill** `scripts/seed/backfill-catalog-spine.ts` resolves every bourbon to
its spine fields, folds near-duplicates to one survivor per expression, and sets
`catalog_included`. Nothing is deleted — hidden rows keep all their enrichment.

### The cut-back keep-rule

A row is member-facing (`catalog_included = true`) iff:
- `specs.in_cobb_collection` is true (a bottle Paul owns — always carried), **or**
- it's the survivor of a **curated** brand's **core/limited** expression.

Everything else — uncurated long tail, discontinued, non-survivor duplicates — is
hidden but promotable: flip `catalog_included` to true to add an individual back.

Dry run over the local data (Cobb adds on top in the DB):
**1,350 bourbons → 62 kept** (curated core/limited survivors), 1,288 hidden.
Per-brand: Four Roses 34→6, Buffalo Trace 45→3, Wild Turkey 22→6, Elijah Craig
30→4, 1792 12→7, Knob Creek 14→5, Maker's Mark 10→4.

### Apply steps (manual, per repo convention)

```bash
# 1. schema (human-reviewed migration)
supabase db push
# 2. preview the cut-back against the real DB (reads only)
pnpm tsx --env-file=.env.local scripts/seed/backfill-catalog-spine.ts
# 3. apply once the preview looks right
pnpm tsx --env-file=.env.local scripts/seed/backfill-catalog-spine.ts --apply
```

### Remaining step — browse wiring (not yet done)

`lib/feed/catalog-queries.ts` still selects a flat list. To realize the win it
must `.eq("catalog_included", true)` and group results by `brand_family` (core
range first, long tail behind "all releases"). This needs a running app + DB to
verify, so it's the next change rather than part of this data-layer pass.

## Scope decision

Mainstream core first — clean the ~30–50 browsed shelf brands; the allocated long
tail (incl. famous allocated bottles like William Larue Weller) is hidden but
one flag-flip from returning. Cobb collection is the spine of what we carry.
(Recorded 2026-05-27.)
