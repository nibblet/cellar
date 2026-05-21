/**
 * Find and merge soft-duplicate bourbon rows across the products catalog.
 *
 * Why: bourbonExplorer and the Cobb collection use different name formats for
 * the same physical bottle (e.g. "Buffalo Trace Stagg Jr., 65.05%" vs.
 * "Stagg Jr. Barrel Proof"). Without a dedupe pass, members see the same
 * bottle twice, tastings split across both rows, and the pairing engine
 * treats them as distinct products.
 *
 * Strategy:
 *   1. Cobb rows always win on identity (Paul owns the bottle — most
 *      authoritative name + brand + mash bill + proof).
 *   2. For each Cobb row, find non-Cobb bourbon rows whose normalized
 *      tokens look like the same product (see lib/product-normalizer).
 *   3. Reassign dependent rows (product_images, product_reviews, tastings,
 *      pairings_cache) from the non-Cobb row to the Cobb row.
 *   4. Union the wheel_vectors (max per leaf) and recompute trait_vector.
 *   5. Delete the orphaned non-Cobb row.
 *
 * Usage:
 *   pnpm dedupe:bourbons --dry-run     # print proposed merges, change nothing
 *   pnpm dedupe:bourbons               # apply merges
 *
 * Idempotent: re-running on a clean catalog is a no-op.
 */

import { rollUpTraits, type WheelVector } from "@/lib/wheel";
import {
  looksLikeSameProduct,
  matchConfidence,
  type ProductIdentity,
} from "./lib/product-normalizer";
import { adminClient } from "./lib/supabase-admin";

export {};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  wheel_vector: WheelVector | null;
  specs: Record<string, unknown> | null;
};

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const supabase = adminClient();

  console.log(`[dedupe-bourbons] ${isDryRun ? "DRY RUN" : "LIVE"}`);

  // Cobb-owned rows (the winners).
  const { data: cobbRaw } = await supabase
    .from("products")
    .select("id, name, brand, wheel_vector, specs")
    .eq("type", "bourbon")
    .filter("specs->>in_cobb_collection", "eq", "true");

  // Every other bourbon row — candidates for merging into a Cobb row.
  const { data: otherRaw } = await supabase
    .from("products")
    .select("id, name, brand, wheel_vector, specs")
    .eq("type", "bourbon");

  const cobbRows = (cobbRaw ?? []) as ProductRow[];
  const otherRows = ((otherRaw ?? []) as ProductRow[]).filter(
    (p) => !cobbRows.some((c) => c.id === p.id),
  );

  console.log(
    `[dedupe-bourbons] cobb rows: ${cobbRows.length}, other bourbon rows: ${otherRows.length}`,
  );

  // Build candidate matches.
  type Match = {
    cobb: ProductRow;
    other: ProductRow;
    confidence: number;
  };
  const matches: Match[] = [];

  for (const cobb of cobbRows) {
    const cobbIdent: ProductIdentity = { brand: cobb.brand, name: cobb.name };
    for (const other of otherRows) {
      const otherIdent: ProductIdentity = { brand: other.brand, name: other.name };
      if (looksLikeSameProduct(cobbIdent, otherIdent)) {
        matches.push({
          cobb,
          other,
          confidence: matchConfidence(cobbIdent, otherIdent),
        });
      }
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);

  if (matches.length === 0) {
    console.log("[dedupe-bourbons] no soft duplicates found. catalog is clean.");
    return;
  }

  console.log(`\n[dedupe-bourbons] ${matches.length} candidate merge(s):`);
  for (const m of matches) {
    const cobbLabel = `${m.cobb.brand ?? "—"} / ${m.cobb.name}`;
    const otherLabel = `${m.other.brand ?? "—"} / ${m.other.name}`;
    console.log(`  [${m.confidence.toFixed(2)}]  KEEP: ${cobbLabel}`);
    console.log(`               MERGE: ${otherLabel}`);
  }

  if (isDryRun) {
    console.log("\n[dedupe-bourbons] dry run — no changes made. Re-run without --dry-run to apply.");
    return;
  }

  // Apply merges.
  let merged = 0;
  let failed = 0;

  for (const m of matches) {
    try {
      // Union the wheel vectors — keep the higher score per leaf.
      const cobbVec = (m.cobb.wheel_vector as WheelVector | null) ?? {};
      const otherVec = (m.other.wheel_vector as WheelVector | null) ?? {};
      const merged_vec: WheelVector = { ...cobbVec };
      for (const [leaf, score] of Object.entries(otherVec)) {
        if (typeof score !== "number") continue;
        merged_vec[leaf] = Math.max(merged_vec[leaf] ?? 0, score);
      }
      const merged_trait = rollUpTraits("bourbon", merged_vec);

      // Reassign dependent rows from the other product to the Cobb product.
      await supabase
        .from("product_images")
        .update({ product_id: m.cobb.id })
        .eq("product_id", m.other.id);

      await supabase
        .from("product_reviews")
        .update({ product_id: m.cobb.id })
        .eq("product_id", m.other.id);

      await supabase
        .from("tastings")
        .update({ product_id: m.cobb.id })
        .eq("product_id", m.other.id);

      // pairings_cache has a composite PK (cigar_id, bourbon_id). Don't try
      // to update — just delete the rows referring to the other product;
      // the engine re-computes on demand.
      await supabase.from("pairings_cache").delete().eq("bourbon_id", m.other.id);
      await supabase.from("pairings_cache").delete().eq("cigar_id", m.other.id);

      // Apply the merged vectors to the Cobb row.
      await supabase
        .from("products")
        .update({ wheel_vector: merged_vec, trait_vector: merged_trait })
        .eq("id", m.cobb.id);

      // Finally, delete the orphaned other row.
      const { error } = await supabase.from("products").delete().eq("id", m.other.id);
      if (error) {
        console.warn(`[dedupe-bourbons] delete failed for ${m.other.name}: ${error.message}`);
        failed += 1;
        continue;
      }

      merged += 1;
    } catch (err) {
      console.warn(`[dedupe-bourbons] merge failed for ${m.cobb.name} <- ${m.other.name}:`, err);
      failed += 1;
    }
  }

  console.log(`\n[dedupe-bourbons] done. merged=${merged} failed=${failed}`);
}

main().catch((err) => {
  console.error("[dedupe-bourbons] fatal:", err);
  process.exit(1);
});
