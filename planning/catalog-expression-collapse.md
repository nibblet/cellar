# Catalog Expression Collapse — Plan

**Status:** in progress, 2026-05-25 (Phase 2 — brand/expression rules)
**Owner:** Paul
**Touches:** `products`, `product_images`, `tastings`, AI vision pipeline, enrichment pipeline

## Problem

The bourbon catalog has drifted toward one row per release/batch/finish (Fusion #1, #2, #4, #6, #7, #8, Discovery #1, #4, #6, #10, #11, every Prisoner finish year, etc.). This causes three concrete failures:

1. **Vision can't tell them apart.** A phone photo of Fusion #6 vs Fusion #8 vs Fusion No. 7 has the same label silhouette. CLIP + vision LLM will match noisily or wrong.
2. **"The club says" goes dark.** With 12 members and ~30 sub-variants per expression, every product page sits at N=0 or N=1 tastings forever. The group voice — the whole point of the app — never accumulates.
3. **Enrichment is duplicated.** We pay to fetch reviews + compute wheel vectors per variant when 90% of the flavor profile is identical at the expression level.

But some variants genuinely matter — Old Forester Birthday Bourbon, BTAC (Stagg/Eagle Rare/Weller/Sazerac/Handy), Four Roses Limited Edition Small Batch, Michter's 10/20/25. Members really do want to log "the 2021 Birthday."

## Solution: parent expression + variant on the tasting

One catalog row per **expression** (the named SKU as a member would say it out loud).  
The **release/batch/pick** lives on the tasting, not the catalog.  
A `vintages_matter` flag on the expression controls whether the product page groups tastings by release.

### Examples

| Expression (one catalog row) | Variants collapsed in | `vintages_matter` |
|---|---|---|
| Bardstown Fusion Series | #1, #2, #4, #6, #7, #8 | false |
| Bardstown Discovery Series | #1, #4, #6, #10, #11 | false |
| Bardstown Collaborative Series | The Prisoner (all years), Goose Island, Plantation Rum, Phifer Pavitt, Ferrand, Chateau de Laubade | false |
| Old Forester Birthday Bourbon | every annual release | **true** |
| George T. Stagg | every BTAC year | **true** |
| Four Roses Single Barrel | every store pick / barrel strength variant | false (store pick captured as release_label) |
| Four Roses Limited Edition Small Batch | every annual release | **true** |
| Michter's 10 Year Bourbon | every batch | false |
| Eagle Rare 17 | every BTAC year | **true** |

Rule of thumb for `vintages_matter` (updated May 2026):
- **`false` for everything.** Release year, batch, barrel, and finish detail live on `tastings.release_label` (chips). Members opt into granularity at capture time; product pages show the club voice for the expression as a whole.
- Collapse aggressively — even BTAC annual releases, Birthday years, and store picks merge into one expression row when the bar-order name is the same.

Legacy note: earlier drafts used `vintages_matter = true` for BTAC, Birthday, Four Roses LE. That grouping is retired in favor of tasting chips.

## Brand + expression rules (Phase 2)

Paul reviewed 1792, Angel's Envy, Baker's, Barrell, and Buffalo Trace (line brands) to define how the bourbon catalog should collapse. Implemented in `apps/web/src/lib/catalog/expression-normalize.ts` and `line-brand.ts`.

### Rule 0 — Line brand promotion (distillery buckets)

**When:** `products.brand` is a **distillery bucket** (today: `Buffalo Trace`) and the member-facing brand is embedded in the product name — or the row already uses a line brand that should merge (`W.L. Weller` → `William Larue Weller`).

**Promotion sources (longest match wins):**
1. **Curated prefix list** — Experimental Collection, William Larue Weller, Pappy Van Winkle, Benchmark, Ancient Age, etc.
2. **Heuristic** — ≥3 catalog rows share the same 2–4 word name prefix (excluding vague words like `Old`, `French`).

**Then:**
- `proposed_brand` = promoted line brand
- Strip prefix from name → parse **expression** (Rule 1b)
- `proposed_canonical_name` = `{line brand} {expression}`

**Buffalo Trace examples:**

| Import (`brand: Buffalo Trace`) | → Brand | → Expression | → Canonical |
|---|---|---|---|
| `Experimental Collection Standard Stave Drying Time` | Experimental Collection | Standard Stave Drying Time | `Experimental Collection Standard Stave Drying Time` |
| `Experimental Collection, 14 year old, Coarse Grain Oak` | Experimental Collection | Coarse Grain Oak | `Experimental Collection Coarse Grain Oak` |
| `William Larue Weller` (year_made 2022) | William Larue Weller | — | `William Larue Weller` + release `2022` |
| `Benchmark Single Barrel` | Benchmark | Single Barrel | `Benchmark Single Barrel` |

Parent distillery stays metadata for now; **`products.brand` updates on collapse migration** via `proposed_brand`.

### Rule 1b — Expression parse after brand strip

| Name shape | Expression source |
|---|---|
| Title after prefix | Remainder text (`Standard Stave Drying Time`) |
| Comma-separated | Last non-age segment (`Coarse Grain Oak`); age stays in `age_label` |
| BTAC / annual series | Empty expression; year → `release_label` |
| Age-defining SKU (Pappy 15 vs 23) | Age tier in expression (`15 Year`) |

### Two-level catalog model

Every bourbon catalog row is **`{Brand} {Expression}`** — what a member would ask for at the bar.

| Field | Role |
|---|---|
| `products.brand` | House / distillery (`1792`, `Angel's Envy`, `Baker's`) |
| `products.name` | Expression — the stable SKU (`Full Proof`, `Cask Strength`, `Single Barrel 7 Year`) |
| `tastings.release_label` | Release detail — year, batch, barrel #, store pick |

### Expression kinds

| Kind | What it is | Collapse rule | `vintages_matter` |
|---|---|---|---|
| **Identity expression** | Finish, edition, or format that *is* the product | One row per finish/edition; collapse duplicate import spellings only | Usually `false` |
| **Series expression** | Core line where releases vary but the name stays the same | Collapse import variants → one row; release on tasting | `true` when members track by year |

### Rule 1 — Expression naming

Derive a short, stable expression label from `name`, `expression_type`, and `specs`:

| Source | Expression label |
|---|---|
| Primary `expression_type` token | `Full Proof`, `Single Barrel`, `Small Batch`, `Bottled-in-Bond` |
| Finish in name/specs | `Port Finish`, `Madeira`, `Oloroso Sherry`, `Mizunara` |
| Age when it defines the SKU | `Single Barrel 7 Year`, `Single Barrel 13 Year` |
| Edition in name | `225th Anniversary` → `Anniversary` |

Canonical product name = `{brand} {expression label}` unless the brand already prefixes the import name.

Do **not** put release years or barrel numbers in the expression name unless they're part of the permanent SKU.

### Rule 2 — Identity expressions (Type A)

**When:** The finish/edition/format is what members distinguish.

One catalog row per distinct finish/edition. Never collapse different finishes into each other.

**1792 examples:** `1792 Anniversary`, `1792 Bottled-in-Bond`, `1792 Port Finish`, `1792 Sweet Wheat`, `1792 12 Year Small Batch` (age + line = separate SKU).

**Angel's Envy examples:** `Angel's Envy Port Finished`, `Angel's Envy Madeira`, `Angel's Envy Oloroso Sherry`, `Angel's Envy Mizunara`, `Angel's Envy Rye` (different spirit — never merge with bourbon).

### Rule 3 — Series expressions (Type B)

**When:** Members say the line name and optionally add "which year" or "which barrel."

One catalog row per line variant. Collapse import variants; put release on the tasting.

**1792 examples:** `1792 Full Proof`, `1792 Single Barrel`, `1792 Small Batch` (not merged with 12 Year SB).

**Angel's Envy examples:**
- `Angel's Envy Cask Strength` — collapse all `(20XX Release)` rows; `release_label` ← `year_made`; `vintages_matter = true`
- `Angel's Envy Cask Strength Port Barrel-Finished` — **separate series** from plain CS
- `Angel's Envy Port Finished Cask Strength` — **separate** from both

**Baker's example:** `Baker's Single Barrel 7 Year` — barrel `#000185706` → `release_label`, `release_pattern = pick`.

Series expressions use an **allowlist** of `expression_type` tokens (`Cask Strength`, `Single Barrel`, `Full Proof`, `Small Batch`, `Straight Bourbon`) that overrides the default "only Straight Bourbon collapses" gate.

### Rule 4 — Age splits expressions

**When:** `age_label` (or age in the permanent SKU name) defines a *different product*, not just a release of the same one.

| Condition | Action |
|---|---|
| Same brand + same line + **different age tier** (7 vs 13) | **Separate expressions** — do not collapse across ages |
| Age only on a release of the same line | Age stays on tasting, not a new row |
| Age baked into permanent SKU name (`12 Year Small Batch`) | **Separate identity expression** |

**Baker's:** `Baker's Single Barrel 7 Year` and `Baker's Single Barrel 13 Year` are two rows. Within 7 Year, collapse barrel variants.

Age in the import name must **not** block within-tier collapse when the canonical expression encodes that age tier.

### Rule 5 — Release → tasting metadata

| Signal | `release_label` | `release_pattern` | `vintages_matter` |
|---|---|---|---|
| `year_made` on annual series (CS, LE, BTAC) | year string | `year` | `true` |
| Batch `#N`, Booker's `2019-03` | batch string | `batch` | usually `false` |
| Barrel #, store pick | barrel/pick string | `pick` | `false` |
| One-off identity expression | null | null | `false` |

### Rule 6 — What never merges

Collapse is keyed on **`products.name`**. Different canonical names always stay separate rows.

1. Different expressions you named separately (Pappy 15 vs 20 vs 23, Baker's 7 Year vs 13 Year)
2. Different finishes (Port vs Madeira vs Oloroso)
3. Different line types (Cask Strength vs Port Finished Cask Strength)
4. Different spirits (Rye vs Bourbon)
5. Legacy/rebrand names (`Ridgemont Reserve 1792` — manual only)

Within a shared canonical name, **`curation_collapse = Y`** merges import duplicates and batch/year variants. Release/batch/expression detail lives on **`tastings.release_label`** and optional expression chips in the UI — not as separate catalog rows.

### Decision tree (normalization script)

```
0. Distillery bucket? → promote line brand (Rule 0); else use catalog brand
1. Extract brand (proposed_brand or products.brand)
2. Strip line brand; parse expression (Rule 1b)
3. Classify expression kind:
   a. Finish/edition in name or specs → Identity (Type A)
   b. Core line token in expression_type → Series (Type B)
4. If age_label differs materially within brand+line → split expression (Rule 4)
5. Build canonical_name = "{Brand} {Expression}"
6. If Type B and group size ≥ 2 with same canonical:
   → collapse variants; release_label from year_made / batch / barrel
   → set vintages_matter if annual series
7. If Type A:
   → one row per finish; collapse only duplicate import spellings
```

### Worked examples

| Import row | → Catalog expression | Kind | Collapse? | Release on tasting |
|---|---|---|---|---|
| 1792 Full Proof | `1792 Full Proof` | Series | N (singleton) | pick optional |
| 1792 225th Anniversary | `1792 Anniversary` | Identity | N | — |
| Angel's Envy CS (2012–2018) | `Angel's Envy Cask Strength` | Series | Y | 2012…2018, vintages |
| Angel's Envy Madeira Cask Finished | `Angel's Envy Madeira` | Identity | N | — |
| Baker's SB 7 Year + (No. 000185706) | `Baker's Single Barrel 7 Year` | Series | Y | barrel # |
| Baker's 13 year old SB | `Baker's Single Barrel 13 Year` | Series | N (singleton) | barrel optional |

### Barrell (catalog brand `Barrell` / `Barrell Craft Spirits`)

43 import rows collapse to ~12 expressions. Brand field normalizes to **`Barrell`**. Spirit type (`bourbon` | `rye`) proposed on staples — Seagrass is rye; Vantage and Dovetail are bourbon.

| Family | Expression | Kind | Collapse | Release on tasting | `vintages_matter` |
|---|---|---|---|---|---|
| **1 — Staples** | `Barrell Vantage` | Identity | — | — | false |
| | `Barrell Dovetail` | Identity | — | — | false |
| | `Barrell Seagrass` | Identity (rye) | — | — | false |
| **2 — Core batch** | `Barrell Bourbon` | Series | Y (~8 batches) | `Batch 004`, `Batch 022`, … | false |
| **3 — Cask Strength** | `Barrell Bourbon Cask Strength` | Series | Y (~15 batches) | `Batch 015`, `Batch 036`, … | false |
| **4 — New Year** | `Barrell New Year` | Series | Y (all years, CS + non-CS) | `2018`, `2021`, … | **true** |
| **Other identity** | Armida, Foundation, Gold Label | Identity | — | — | false |
| | Cask Finish Series (Amburana, Mizunara, Tale of Two Islands) | Identity ×3 | — | — | false |
| | `Barrell Private Release` | Identity | — | pick code (`CSX8`) | false |

**Decisions locked:**
1. New Year — **one** expression (CS and non-CS editions share a row; year on tasting).
2. Aged CS rows without batch in name (e.g. 15 year Cask-Strength) — **fold into Family 3**.
3. Cask Finish Series — **three** separate identity rows.
4. `Barrell Craft Spirits` brand — **merge** to `Barrell`.
5. Private Release — **one** row; pick codes on tastings.

**Decision tree (Barrell):**
```
brand is Barrell / Barrell Craft Spirits?
├─ Vantage | Dovetail | Seagrass → identity staple (Seagrass = rye)
├─ "New Year" in name → Barrell New Year (year release, vintages_matter)
├─ Cask Strength / Cask-Strength (not New Year) → Barrell Bourbon Cask Strength (batch)
├─ Barrell Bourbon (Batch N) or N yr Bourbon (Batch N) → Barrell Bourbon (batch)
├─ Named SKU (Armida, Foundation, Gold Label, Cask Finish Series:*) → identity
├─ Private Release → Barrell Private Release (pick code)
└─ else → manual review
```

## Schema changes

### 1. `products` — add expression-level fields

```sql
alter table public.products add column vintages_matter boolean not null default false;
alter table public.products add column release_pattern text;
-- release_pattern: human hint to the UI about what to ask for, e.g.
--   'year'   → "Which year? (e.g., 2021)"
--   'batch'  → "Batch number? (optional)"
--   'pick'   → "Store pick or barrel name? (optional)"
--   null     → don't prompt
```

`release_pattern` is purely a UI hint; it doesn't constrain what gets stored.

### 2. `tastings` — capture the variant inline

```sql
alter table public.tastings add column release_label text;
-- Free text. Examples: "2021", "Batch 22F", "Justins' House Pick", "The Prisoner 2022".
-- Optional. Vision can pre-fill from the photo; member can edit/clear.

alter table public.tastings add column release_year smallint;
-- Parsed from release_label when present and numeric. Enables year-grouping
-- on product pages where vintages_matter = true without parsing text at query time.

create index tastings_product_release_year_idx
  on public.tastings (product_id, release_year desc)
  where release_year is not null;

create type public.release_label_source as enum ('vision', 'member', 'migration');

alter table public.tastings add column release_label_source public.release_label_source;
-- Telemetry: who/what populated release_label.
--   'vision'    → vision LLM extracted it from the photo
--   'member'    → member typed or edited it on the confirm screen
--   'migration' → backfilled from the catalog_collapse_map during the collapse migration
-- Null when release_label is null. Used to measure vision accuracy: compare
-- vision-set values that members later edited vs. accepted as-is.
```

We are **not** creating a `product_releases` table. That's the trap that got us here. Releases are tasting metadata, not catalog entities.

### 3. `product_images` — hero per expression, all images attached to the parent

No schema change. The existing one-hero-per-product constraint is correct. Images contributed for any variant attach to the parent expression. Vision similarity search benefits from more images per expression, not fewer.

If `vintages_matter` is true and we want the UI to show "the 2021 bottle" specifically, that lives at the **tasting** level (`tastings.photo_image_id` already points at the member's own photo).

### 4. Migration: collapse existing rows

A one-shot migration `20260525000001_catalog_expression_collapse.sql`:

1. Build a mapping table `catalog_collapse_map (old_product_id, new_product_id, release_label)` — generated offline by Paul with LLM help, reviewed by hand.
2. For each row in the map:
   - Repoint every `tastings.product_id = old` to `new`, set `release_label`.
   - Repoint `product_images.product_id = old` to `new`.
   - Repoint `product_reviews.product_id = old` to `new`.
   - Repoint `pairings_cache` rows (or just delete and recompute — easier).
   - Repoint `member_saves`, `suggestions`, anything else FK'ing products.
3. Delete the old rows.
4. Recompute `products.wheel_vector` for the surviving expressions from the union of reviews now attached.
5. Recompute `pairings_cache` for surviving expressions.

The map is the artifact devops needs from Paul. Migration logic is mechanical once the map exists.

## AI vision pipeline — what changes

Today (implied by `products.image_url` + `product_images.embedding`): vision pipeline matches a photo to the closest product in the catalog.

After collapse:

1. **CLIP similarity** runs against expression-level images only. Match confidence goes **up** because the candidate set is smaller and labels are visually distinct at the expression level.
2. **Vision LLM second pass** (`gpt-5-mini`) is given the top-N expression candidates AND asked a second question: *"If this expression has a year, batch, or pick visible on the label, return it as `release_label`."* This is one extra field in the JSON response, near-zero extra token cost.
3. **Auto-fill the tasting form** with `product_id = matched expression` and `release_label = parsed string`. Set `release_label_source = 'vision'` on insert. If the member edits the field on the confirm screen, flip `release_label_source` to `'member'`. This is the telemetry pair we'll measure vision accuracy against.

Net effect on vision quality:
- Fewer near-duplicate candidates → fewer wrong matches.
- Release detail captured as text, not as a catalog identity → no penalty when vision can't read the year.
- More training photos per expression → embedding clusters get tighter over time.

## Enrichment pipeline — what changes

Today: every catalog row triggers review fetch + wheel vector extraction + trait vector roll-up.

After collapse:
- We enrich **once per expression**, not once per variant. Roughly 5–10x reduction in enrichment cost on the bourbon side based on the current catalog.
- Reviews from variant-specific sources (e.g., "Fusion #6 review on Breaking Bourbon") still attach to the parent expression. The wheel vector aggregation already handles multiple reviews per product — that's the existing path, just with more inputs.
- For `vintages_matter = true` expressions, we can optionally enrich at the release level later (separate review table or a JSON column on tastings). Out of scope for v1. Year-to-year flavor variance is small enough that the parent's wheel vector is a good-enough prior.

## UI changes (sketch, not in this migration)

- **Capture flow:** after vision returns expression + release_label, the confirm screen shows the bottle name and a small editable field labeled per `release_pattern` ("Year?", "Batch?", "Store pick?"). Empty is fine.
- **Product detail page** when `vintages_matter = false`: pools all tastings, shows aggregate "the club says" cloud as today. Release labels show as small chips on individual tasting cards.
- **Product detail page** when `vintages_matter = true`: groups tastings by `release_year` (or by `release_label` when year is null). Each year gets its own mini-section with its own recommend count and chip cloud. Default sort: newest year first.
- **Feed:** tasting cards show "Old Forester Birthday Bourbon · 2021" when release_label is set.

## What devops needs from Paul

1. The **collapse map** (`old_product_id → new expression name + release_label`). Paul builds this with LLM assist against the current bourbon catalog. Reviewed before the migration runs.
2. The **vintages_matter list** — which surviving expressions get the flag. Probably ~20 bourbons. Default everything else to false.
3. Sign-off on **deleting `pairings_cache`** wholesale during migration (it gets recomputed anyway).

## What's explicitly out of scope

- A separate `product_releases` table. Releases are tasting metadata.
- Per-release flavor wheels or per-release wheel vectors. Parent expression's vector is the single source.
- Per-release pricing/availability. Tier and availability live on the expression.
- Doing the same collapse for cigars right now. Cigars have a different variant problem (vitola/size) that's already modeled in `specs`; we'll evaluate after bourbon ships.

## Open questions

- Does `release_label` need a normalization step (e.g., "21" → "2021", "BTAC '22" → "2022")? Probably yes for year extraction; a small server-side parse on insert is enough.
- For BTAC-style expressions where every year is a different ABV/age statement, should we surface those facts on the tasting card? Out of scope but worth tracking — it might want `tastings.release_specs jsonb` later.
- Do we want a `tastings.release_label_source enum('vision','member','migration')` for telemetry on vision accuracy? Cheap to add, useful for tuning.
