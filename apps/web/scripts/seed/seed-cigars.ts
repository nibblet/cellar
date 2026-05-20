/**
 * Cigar catalog seeding via Halfwheel RSS feed.
 *
 * Strategy:
 *   1. Fetch the Halfwheel "cigar reviews" RSS feed (most recent ~25 reviews).
 *   2. Page back through ?paged=2..N to cover ~3 years of reviews.
 *   3. For each review item: extract title, link, summary, full content.
 *   4. Use gpt-5-mini to extract structured product info (brand, line, vitola,
 *      wrapper, country, strength) from the prose.
 *   5. Insert into products with source='seed' and store the review prose in
 *      product_reviews for descriptor enrichment.
 *
 * NOT IMPLEMENTED YET — this script needs a Halfwheel RSS reachability check
 * and a few sample feed parses before we hammer them. For now, this is a
 * skeleton that documents the intended flow. Phase 1 actual cigar seeding
 * will be done manually in batches once we have OpenAI keys wired in.
 *
 * To unblock Phase 1 catalog content for cigars:
 *   - Hand-curate ~50 cigars members actually smoke (NCCC favorites)
 *   - Run them through this script's `ingestCigar({ name, brand, ... })` once
 *     the LLM-assisted variant is implemented.
 *   - Long tail fills in organically via the in-app capture flow (Phase 2).
 *
 * Run:  pnpm seed:cigars
 */

export {};

async function main() {
  console.log("[seed-cigars] not implemented — see TODO in source.");
  console.log("[seed-cigars] cigar catalog will fill in via in-app captures (Phase 2)");
  console.log("[seed-cigars] and manual curation runs once OpenAI keys are wired.");
}

main().catch((err) => {
  console.error("[seed-cigars] failed:", err);
  process.exit(1);
});
