/**
 * Clear enrichment_pending on bourbons that already have image + Apify reviews.
 *
 *   pnpm clear:stale-enrichment-pending
 *   pnpm clear:stale-enrichment-pending --dry-run
 */

import { adminClient } from "./lib/supabase-admin";

const SEED_SOURCES = new Set([
  "halfwheel",
  "stickpicks",
  "cigar-api",
  "cigarbase",
  "bourbonExplorer",
  "seed",
]);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supa = adminClient();

  const apifyByProduct = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supa
      .from("product_reviews")
      .select("product_id, source")
      .range(from, from + 999);
    if (!data?.length) break;
    for (const row of data) {
      if (SEED_SOURCES.has(row.source)) continue;
      apifyByProduct.set(row.product_id, (apifyByProduct.get(row.product_id) ?? 0) + 1);
    }
  }

  const pending: Array<{ id: string; name: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supa
      .from("products")
      .select("id, name, image_url, specs")
      .eq("type", "bourbon")
      .range(from, from + 999);
    if (!data?.length) break;
    for (const row of data) {
      if (row.specs?.enrichment_pending !== true) continue;
      if (!row.image_url) continue;
      if ((apifyByProduct.get(row.id) ?? 0) === 0) continue;
      pending.push({ id: row.id, name: row.name });
    }
  }

  console.log(
    `[clear-stale-enrichment-pending] ${dryRun ? "DRY RUN" : "LIVE"} — ${pending.length} rows`,
  );

  if (dryRun) {
    for (const p of pending.slice(0, 20)) console.log(`  ${p.name}`);
    if (pending.length > 20) console.log(`  … and ${pending.length - 20} more`);
    return;
  }

  let cleared = 0;
  for (const p of pending) {
    const specs = (
      await supa.from("products").select("specs").eq("id", p.id).single()
    ).data?.specs as Record<string, unknown> | null;
    if (!specs) continue;
    const next = { ...specs };
    delete next.enrichment_pending;
    const { error } = await supa.from("products").update({ specs: next }).eq("id", p.id);
    if (error) {
      console.warn(`  failed ${p.name}: ${error.message}`);
      continue;
    }
    cleared += 1;
  }

  console.log(`[clear-stale-enrichment-pending] cleared ${cleared} flags`);
}

main().catch((err) => {
  console.error("[clear-stale-enrichment-pending] fatal:", err);
  process.exit(1);
});
