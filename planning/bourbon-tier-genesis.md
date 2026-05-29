# NCCC — Bourbon Tier Enrichment (Genesis Prompt)

Paste the block below as your first message in a fresh Claude/Cursor session.

Last updated **2026-05-23**.

---

## Paste from here ↓

We're building **bourbon allocation/rarity tier enrichment** for the NCCC app — a dedicated LLM batch pass, separate from Apify and separate from `enrich-specs`.

**Working directory:** `/Volumes/Lexar/NCCC/`  
**Stack:** Next.js 16, Supabase, TypeScript, Biome, Vitest, OpenAI `gpt-5-nano` for classification.

### Read before writing code

1. `CLAUDE.md` — conventions (no ESLint, server-first, `@/` imports)
2. `planning/nccc-roadmap.md` — Tier 2 #24 (rarity tiers) + open question on bourbon tier enrichment (~line 1000)
3. `apps/web/scripts/seed/enrich-specs.ts` — CLI pattern to mirror (`--type`, `--limit`, `--dry-run`, jsonl audit log)
4. `apps/web/scripts/seed/seed-cobb-whiskey.ts` — how Paul's Cobb xlsx writes `specs.tier` (1–5)
5. `apps/web/src/lib/catalog/normalize-specs.ts` — already reads `specs.tier` as `cobbTier`; Facts strip shows `Tier N`

### What exists today

| Signal | Count (Paul's audit) | Source |
|--------|---------------------|--------|
| Bourbons with `specs.tier` | ~101 | Cobb xlsx via `pnpm seed:cobb-whiskey` |
| Bourbons with price | ~286 | `price_usd` / `msrp_usd` |
| Total bourbons | ~2,098 | bourbonExplorer seed + Cobb merges |

**Cobb rows do NOT yet set `tier_source`.** Backfill `tier_source: 'cobb'` on rows where `specs.in_cobb_collection = true` and `specs.tier` is set — either in the new script or a one-time migration in the seeder.

**Do NOT use Apify or `product_reviews` for this pass.** Apify is for images + review prose. Tier is a cheap classification job from structured product identity.

**Do NOT use `enrich-specs` for tier.** That extractor requires review markdown and pulls msrp/proof/etc. Tier needs to run on the full bourbon catalog using only name + specs fields already on the row.

### Target data shape (no new DB columns — jsonb only)

```jsonc
// products.specs
{
  "tier": 3,                    // integer 1–5, aligned with Cobb scale
  "tier_source": "llm",         // "cobb" | "llm" | "manual"
  "tier_rationale": "..."       // optional one-line LLM reason for audit
}
```

**Tier semantics (align with Cobb + roadmap #24):**

| tier | Meaning | Display rarity (derive at render, don't store yet) |
|------|---------|-----------------------------------------------------|
| 1–2 | Widely available shelf bourbon | Common |
| 3 | Seasonal / limited but findable | Uncommon |
| 4–5 | Allocated, lottery, secondary-market, discontinued gem | Rare |

The LLM prompt should encode NCCC-relevant allocation knowledge (BTAC, Pappy, Weller full-proof, standard Buffalo Trace shelf, etc.) but **must not hallucinate** — when uncertain, prefer tier 2–3 over 5.

### Build scope (this session)

**Ship:**

1. **`apps/web/src/lib/enrich/bourbon-tier.ts`**
   - Structured output schema: `{ tier: 1|2|3|4|5, rationale: string }`
   - System prompt: allocation/rarity classifier for US bourbon retail reality
   - Input payload built from: `name`, `brand`, `specs.distillery`, `specs.proof`, `specs.age_years`, `specs.age_label`, `specs.mash_bill`, `specs.whiskey_type`, `specs.expression_type`, `specs.additional_notes`
   - Pure helper: `tierToRarityLabel(tier) → 'common' | 'uncommon' | 'rare'`

2. **`apps/web/src/lib/enrich/bourbon-tier.test.ts`**
   - Unit tests on `tierToRarityLabel` + any merge/skip logic

3. **`apps/web/scripts/seed/enrich-bourbon-tier.ts`**
   - `pnpm seed:enrich-bourbon-tier --limit 50 --dry-run`
   - Query: `type = 'bourbon'`, `status = 'confirmed'`, ordered by name
   - **Skip** when `specs.tier_source` is `'cobb'` or `'manual'` (never overwrite Paul)
   - **Skip** when `specs.tier` exists AND `tier_source` is missing — optional `--force` flag to backfill source only
   - Merge: only write `tier`, `tier_source: 'llm'`, `tier_rationale` if tier was null OR `--force`
   - Jsonl audit log under `scripts/seed/data/private/tier-{timestamp}.jsonl`
   - Token tally in stdout

4. **`package.json` script:** `"seed:enrich-bourbon-tier": "tsx --env-file=.env.local scripts/seed/enrich-bourbon-tier.ts"`

**Optional same session if time:**

5. Update `seed-cobb-whiskey.ts` to stamp `tier_source: 'cobb'` on insert/merge
6. Add `tierToRarityLabel` to `normalize-specs.ts` + muted "Uncommon" token on Facts strip (only when tier present) — **display only, no pairing engine bonus yet**

**Explicitly out of scope:**

- Pairing engine +5 Rare×Rare bonus (Paul spot-checks LLM tiers first)
- Catalog filter chip "Show rare only"
- Cigar rarity (separate thread)
- Promoting `tier` to a first-class column (Tier 3 #13)
- Apify changes

### Verification workflow

```bash
cd apps/web

# 1. Dry-run 20 rows — inspect audit log + stdout rationales
pnpm seed:enrich-bourbon-tier --limit 20 --dry-run

# 2. Spot-check known bottles in the log:
#    - Buffalo Trace → tier 1–2
#    - Blanton's / Eagle Rare → tier 3
#    - Pappy / BTAC / William Larue Weller → tier 4–5

# 3. Run 100 for real
pnpm seed:enrich-bourbon-tier --limit 100

# 4. SQL audit
# SELECT specs->>'tier_source', count(*) FROM products
#   WHERE type='bourbon' GROUP BY 1;
# SELECT name, brand, specs->>'tier', specs->>'tier_rationale'
#   FROM products WHERE type='bourbon' AND specs->>'tier_source'='llm'
#   ORDER BY random() LIMIT 20;

pnpm test && pnpm typecheck && pnpm lint
```

Paul reviews the random-20 sample before running `--limit 2000` on the full catalog.

### Model + cost

- Use **`gpt-5-nano`** (same as specs extractor) — classification, not prose
- Structured JSON output via OpenAI response_format / zod
- ~2k rows × tiny prompt ≈ pennies; still support `--limit` and `--dry-run`

### Code patterns to follow

- Admin client: `scripts/seed/lib/supabase-admin.ts`
- Non-destructive merge: existing non-null `tier` from Cobb wins unless `--force`
- Self-documenting names; comments only for non-obvious skip rules
- No defensive code for impossible states

### Open decisions — ask Paul if unclear

1. Should uncertain LLM rows default to **tier 2** (conservative) or **tier 3**?
2. Backfill `tier_source: 'cobb'` on existing 101 rows automatically, or separate one-shot?
3. Show **"Tier 3"** vs **"Uncommon"** on product detail for LLM rows?

### Success criteria

- [ ] `pnpm seed:enrich-bourbon-tier --limit 20 --dry-run` produces sensible tiers for staples
- [ ] Cobb rows never overwritten
- [ ] Audit jsonl captures every row + rationale + tokens
- [ ] Unit tests pass; no new migrations
- [ ] Roadmap open question updated when merged

Start by reading the files listed above, then implement the script + lib module. Run dry-run on 20 and show Paul a sample of the audit output before batching the full catalog.

## Paste to here ↑
