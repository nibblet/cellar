/**
 * Collapse bourbon catalog variants into parent expressions.
 *
 * Reads data/catalog-collapse-map.json (copy from catalog-collapse-map.example.json).
 * Each entry merges one variant row into its parent expression, setting release_label
 * on repointed tastings.
 *
 * Usage:
 *   pnpm collapse:catalog --dry-run
 *   pnpm collapse:catalog
 *
 * After collapse, delete pairings_cache wholesale (script does per-row) and recompute
 * wheel vectors on surviving expressions from merged reviews.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rollUpTraits, type WheelVector } from "@/lib/wheel";
import { parseReleaseLabel } from "@/lib/tasting/release-label";
import { adminClient } from "./lib/supabase-admin";

export {};

type MapEntry = {
  old_product_id?: string;
  new_product_id?: string;
  old_name?: string;
  expression_name?: string;
  release_label: string;
  vintages_matter?: boolean;
  release_pattern?: "year" | "batch" | "pick";
};

const MAP_PATH = resolve(process.cwd(), "../../data/catalog-collapse-map.json");

async function resolveProductId(
  supabase: ReturnType<typeof adminClient>,
  by: { id?: string; name?: string },
): Promise<string | null> {
  if (by.id) return by.id;
  if (!by.name) return null;
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("type", "bourbon")
    .eq("name", by.name)
    .maybeSingle();
  return data?.id ?? null;
}

function loadMap(): MapEntry[] {
  const raw = readFileSync(MAP_PATH, "utf8");
  const parsed = JSON.parse(raw) as MapEntry[];
  return parsed.filter((e) => !("_comment" in e && Object.keys(e).length === 1));
}

async function recomputeWheelVector(
  supabase: ReturnType<typeof adminClient>,
  productId: string,
): Promise<void> {
  const { data: reviews } = await supabase
    .from("product_reviews")
    .select("extracted_vector")
    .eq("product_id", productId);

  const merged: WheelVector = {};
  for (const row of reviews ?? []) {
    const vec = row.extracted_vector as WheelVector | null;
    if (!vec) continue;
    for (const [leaf, score] of Object.entries(vec)) {
      if (typeof score !== "number") continue;
      merged[leaf] = Math.max(merged[leaf] ?? 0, score);
    }
  }

  if (Object.keys(merged).length === 0) return;

  await supabase
    .from("products")
    .update({
      wheel_vector: merged,
      trait_vector: rollUpTraits("bourbon", merged),
    })
    .eq("id", productId);
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const supabase = adminClient();
  const map = loadMap();

  if (map.length === 0) {
    console.log("[collapse-catalog] map is empty — nothing to do.");
    return;
  }

  console.log(`[collapse-catalog] ${isDryRun ? "DRY RUN" : "LIVE"} — ${map.length} entries`);

  const expressionMeta = new Map<
    string,
    { vintages_matter?: boolean; release_pattern?: string }
  >();

  let applied = 0;
  let failed = 0;

  for (const entry of map) {
    const oldId = await resolveProductId(supabase, {
      id: entry.old_product_id,
      name: entry.old_name,
    });
    const newId = await resolveProductId(supabase, {
      id: entry.new_product_id,
      name: entry.expression_name,
    });

    if (!oldId || !newId) {
      console.warn(
        `[collapse-catalog] skip — could not resolve IDs for ${entry.old_name ?? entry.old_product_id}`,
      );
      failed += 1;
      continue;
    }

    if (oldId === newId) {
      console.warn(`[collapse-catalog] skip — old and new are the same (${oldId})`);
      continue;
    }

    console.log(`  MERGE ${entry.old_name ?? oldId} → ${entry.expression_name ?? newId} (${entry.release_label})`);

    if (entry.vintages_matter != null || entry.release_pattern) {
      expressionMeta.set(newId, {
        vintages_matter: entry.vintages_matter,
        release_pattern: entry.release_pattern,
      });
    }

    if (isDryRun) continue;

    try {
      const parsed = parseReleaseLabel(entry.release_label);
      await supabase
        .from("tastings")
        .update({
          product_id: newId,
          release_label: parsed.release_label,
          release_year: parsed.release_year,
          release_label_source: "migration",
        })
        .eq("product_id", oldId);

      await supabase.from("product_images").update({ product_id: newId }).eq("product_id", oldId);
      await supabase.from("product_reviews").update({ product_id: newId }).eq("product_id", oldId);
      await supabase.from("member_saves").update({ product_id: newId }).eq("product_id", oldId);
      await supabase.from("pairing_sessions").update({ bourbon_id: newId }).eq("bourbon_id", oldId);
      await supabase.from("pairing_sessions").update({ cigar_id: newId }).eq("cigar_id", oldId);

      await supabase.from("pairings_cache").delete().eq("bourbon_id", oldId);
      await supabase.from("pairings_cache").delete().eq("cigar_id", oldId);

      const { error: deleteError } = await supabase.from("products").delete().eq("id", oldId);
      if (deleteError) throw deleteError;

      applied += 1;
    } catch (err) {
      console.warn(`[collapse-catalog] failed for ${entry.old_name}:`, err);
      failed += 1;
    }
  }

  if (isDryRun) {
    console.log("\n[collapse-catalog] dry run — no changes made.");
    return;
  }

  for (const [productId, meta] of expressionMeta) {
    if (meta.vintages_matter != null || meta.release_pattern) {
      await supabase
        .from("products")
        .update({
          vintages_matter: meta.vintages_matter ?? false,
          release_pattern: meta.release_pattern ?? null,
        })
        .eq("id", productId);
    }
    await recomputeWheelVector(supabase, productId);
  }

  const survivors = new Set(map.map((e) => e.new_product_id).filter(Boolean));
  for (const entry of map) {
    const newId = entry.new_product_id ?? (await resolveProductId(supabase, { name: entry.expression_name }));
    if (newId && !survivors.has(newId)) {
      await recomputeWheelVector(supabase, newId);
    }
  }

  console.log(`\n[collapse-catalog] done. merged=${applied} failed=${failed}`);
}

main().catch((err) => {
  console.error("[collapse-catalog] fatal:", err);
  process.exit(1);
});
