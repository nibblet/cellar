# Dev Plan: [IDEA-007] Surface availability_rarity + cobbTier on catalog cards

## What This Does
The bourbon CSV seed (`data/catalog/bourbon-shelf.csv`) now carries `availability`,
`tier`, and `price_usd` for every bottle on Paul's shelf. These fields land in
`specs.availability_rarity`, `specs.tier`, and `specs.price_usd`. They are
normalised in `lib/catalog/normalize-specs.ts` via `normalizeAvailabilityRarity()`
and `normalizeCobbTier()` but never surfaced to members browsing the catalog — they
exist only as data, invisible in the UI.

This plan surfaces them in two places:
1. **Catalog card subtitle** — add the availability label (when non-everyday) and
   a "Tier N" token to the facts line that already shows price bucket, age, proof.
2. **Product detail subtitle** — same facts line, same two tokens for bourbons.

Members browsing the Bourbons tab will immediately see "Allocated", "Lottery",
"Seasonal" on the bottles that are hard to find, and "Tier 4" on the unicorn shelves.
Zero AI cost. Pure DB data already present.

## User Stories
- As a member, I want to see at a glance which bottles are Allocated or Lottery so
  I know before tapping a product whether it's something I can realistically hunt.
- As a member browsing similar-tier suggestions on `WinstonSuggests`, I want the
  same tier/price metadata I see on catalog cards to appear there too.

## Implementation

### Phase 1: Extend `composeProductSubtitle`
File: `apps/web/src/lib/catalog/product-subtitle.ts`

Current bourbon token order: `priceBucket → age_label → proof → expression_type`

Add two tokens for bourbons only (after `expression_type`):
- `availabilityLabel` when non-null AND not "everyday" (everyday is default; surfacing
  it adds no signal)
- `cobbTier` formatted as "Tier N" when non-null

```ts
// product-subtitle.ts
import {
  formatPriceBucket,
  normalizeAvailabilityRarity,
  normalizeCobbTier,
  normalizeProductSpecs,
} from "@/lib/catalog/normalize-specs";

export function composeProductSubtitle(
  productType: ProductType,
  specs: Record<string, unknown>,
): string | null {
  const { priceBucket } = normalizeProductSpecs(productType, specs);
  const tokens: string[] = [];
  if (priceBucket != null) tokens.push(formatPriceBucket(priceBucket));

  if (productType === "cigar") {
    if (typeof specs.vitola === "string" && specs.vitola) tokens.push(specs.vitola);
    if (typeof specs.strength === "string" && specs.strength) tokens.push(specs.strength);
    if (typeof specs.country === "string" && specs.country) tokens.push(specs.country);
  } else {
    if (typeof specs.age_label === "string" && specs.age_label) {
      const age = specs.age_label;
      const needsSuffix = /^\d+(\.\d+)?$/.test(age);
      tokens.push(needsSuffix ? `${age}yr` : age);
    }
    if (typeof specs.proof === "number") tokens.push(`${specs.proof} proof`);
    if (typeof specs.expression_type === "string" && specs.expression_type)
      tokens.push(specs.expression_type);

    // ── new tokens ──────────────────────────────────────────────
    const avail = normalizeAvailabilityRarity(specs);
    if (avail && avail !== "everyday") {
      const AVAIL_LABELS: Record<string, string> = {
        seasonal: "Seasonal",
        allocated: "Allocated",
        lottery: "Lottery",
        "secondary-only": "Secondary only",
        discontinued: "Discontinued",
      };
      const label = AVAIL_LABELS[avail];
      if (label) tokens.push(label);
    }
    const tier = normalizeCobbTier(specs);
    if (tier != null) tokens.push(`Tier ${tier}`);
  }

  return tokens.length > 0 ? tokens.join(" · ") : null;
}
```

**Checkpoint:** `composeProductSubtitle("bourbon", { availability_rarity: "allocated", tier: 4, proof: 95 })` returns a string containing "Allocated" and "Tier 4".

### Phase 2: Add unit tests
File: (test for `product-subtitle.ts` does not yet exist — add inline in
`apps/web/src/lib/catalog/` as `product-subtitle.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { composeProductSubtitle } from "./product-subtitle";

describe("composeProductSubtitle", () => {
  it("includes availability when non-everyday", () => {
    const s = composeProductSubtitle("bourbon", { availability_rarity: "allocated" });
    expect(s).toContain("Allocated");
  });
  it("omits availability when everyday", () => {
    const s = composeProductSubtitle("bourbon", { availability_rarity: "everyday" });
    expect(s).not.toContain("everyday");
  });
  it("includes tier when present", () => {
    const s = composeProductSubtitle("bourbon", { tier: 3 });
    expect(s).toContain("Tier 3");
  });
  it("does not include availability for cigars", () => {
    const s = composeProductSubtitle("cigar", { availability_rarity: "allocated" });
    expect(s).not.toContain("Allocated");
  });
});
```

**Checkpoint:** `pnpm test` includes new subtitle tests and they pass.

### Phase 3: Verify CatalogEntry carries specs fields
File: `apps/web/src/lib/feed/catalog-queries.ts`

The `ProductRow` type already includes `specs: Record<string, unknown> | null`.
`composeProductSubtitle` is already called on line ~130 of the catalog queries
function to populate `CatalogEntry.subtitle`. Since `specs` is already fetched and
passed, the new tokens appear automatically on the card subtitle without any
query change.

If `specs` is being stripped before `composeProductSubtitle` is called, add
`availability_rarity` and `tier` to the select. (Verify by inspecting the query
in `loadCatalogSlice`.)

**Checkpoint:** Browse the Bourbons catalog tab — allocated bottles should now show
"Allocated" in their subtitle under the product name.

### Phase 4: Verify product detail
File: `apps/web/src/app/(app)/(shell)/products/[id]/page.tsx`

Line 134: `const subtitle = composeProductSubtitle(productType, specs)` — already
passes the full `specs` JSONB from the product row. The new tokens will appear on
product detail headers automatically.

**Checkpoint:** Open a product detail page for an allocated bourbon — subtitle shows
"Allocated · Tier N" where applicable.

## AI / Embedding Considerations
No AI calls. Pure data derivation from existing DB fields. Zero incremental cost.

## Design System Compliance
- `subtitle` is rendered in `text-foreground-muted` — correct for supporting metadata.
- No brass element added.
- No Winston voice added.
- No moss or ember color added.
- `formatMemberName` not involved.

## Mobile Constraints
The subtitle line already truncates (`truncate` CSS class on the catalog card subtitle
element). Long strings like "Discontinued · Tier 5" will ellipsis gracefully on narrow
cards. On product detail the header subtitle wraps naturally. Both are fine on iPhone SE.

## Database / RLS
No schema changes. No migrations. `specs.availability_rarity` and `specs.tier` are
already written by `seed-catalog.ts` via `specsPatch()`.

## Testing
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (new `product-subtitle.test.ts` tests included)
- [ ] Allocated bourbons (e.g. Pappy, BTAC) show "Allocated" in catalog card subtitle
- [ ] Everyday bourbons (e.g. Buffalo Trace) do NOT show an availability token
- [ ] Product detail for an allocated bourbon shows availability + tier in header subtitle
- [ ] Mobile viewport: subtitle truncates cleanly on narrow cards

## Dependencies
None. Prerequisite data already written by seed-catalog runs.

## Estimated Total: 1 hour
