/**
 * Seed the products table with bourbons from BourbonData.csv.
 *
 * Three match modes per row (in order):
 *   1. Exact (type, name, brand) → full update with bourbonExplorer specs
 *      and wheel_vector.
 *   2. Soft match via product-normalizer (catches the same bottle under a
 *      different name string — e.g. the Cobb collection's "Stagg Jr. Barrel
 *      Proof" vs. this CSV's "Buffalo Trace Stagg Jr., 65.05%") → ENRICHED
 *      update: union the wheel_vector and add a product_review, but do NOT
 *      overwrite name/brand/specs (the soft-matched row's identity is more
 *      authoritative — usually a Cobb row).
 *   3. No match → insert as a fresh confirmed seed row.
 *
 * Idempotent. Safe to re-run after dedupe.
 *
 * Run:  pnpm seed:bourbons
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ProductType, rollUpTraits, type WheelVector } from "@/lib/wheel";
import { parseBourbonRow, type BourbonCsvRow } from "./lib/bourbon-parser";
import { readCsv } from "./lib/csv";
import {
  canonicalIdentity,
  looksLikeSameProduct,
  type ProductIdentity,
} from "./lib/product-normalizer";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "data", "BourbonData.csv");
const WHEEL_VERSION = "0.1";
const TYPE: ProductType = "bourbon";

type CacheEntry = {
  id: string;
  name: string;
  brand: string | null;
  wheel_vector: WheelVector | null;
  canonical: string;
};

async function main() {
  const supabase = adminClient();
  const rows = await readCsv<BourbonCsvRow>(CSV_PATH);
  console.log(`[seed-bourbons] read ${rows.length} rows from BourbonData.csv`);

  // Pull every bourbon row once; we'll do exact + soft matching in memory.
  // ~1,400 rows × small payload is comfortably under any practical limit.
  const { data: existingRows } = await supabase
    .from("products")
    .select("id, name, brand, wheel_vector")
    .eq("type", TYPE);

  type RawRow = { id: string; name: string; brand: string | null; wheel_vector: WheelVector | null };
  const cache: CacheEntry[] = ((existingRows as RawRow[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    wheel_vector: r.wheel_vector,
    canonical: canonicalIdentity(r.brand, r.name),
  }));
  console.log(`[seed-bourbons] loaded ${cache.length} existing bourbon rows for matching`);

  let inserted = 0;
  let updated = 0;
  let enriched = 0;
  let processed = 0;
  const unmappedCounts = new Map<string, number>();

  for (const row of rows) {
    const parsed = parseBourbonRow(row);
    if (!parsed) continue;

    processed += 1;
    if (processed % 100 === 0) {
      console.log(
        `[seed-bourbons] ${processed} rows… (inserted ${inserted}, updated ${updated}, enriched ${enriched})`,
      );
    }

    for (const u of parsed.unmapped_descriptors) {
      unmappedCounts.set(u, (unmappedCounts.get(u) ?? 0) + 1);
    }

    const traitVector = rollUpTraits(TYPE, parsed.wheel_vector);
    const parsedIdent: ProductIdentity = { brand: parsed.brand, name: parsed.name };
    const parsedCanonical = canonicalIdentity(parsed.brand, parsed.name);

    // Mode 1: exact match.
    const exact = cache.find(
      (c) => c.name === parsed.name && (c.brand ?? "") === (parsed.brand ?? ""),
    );

    if (exact) {
      const { error } = await supabase
        .from("products")
        .update({
          type: TYPE,
          name: parsed.name,
          brand: parsed.brand,
          specs: parsed.specs,
          wheel_version: WHEEL_VERSION,
          wheel_vector: parsed.wheel_vector,
          trait_vector: traitVector,
          status: "confirmed" as const,
          source: "seed" as const,
        })
        .eq("id", exact.id);
      if (error) throw error;
      exact.wheel_vector = parsed.wheel_vector;
      updated += 1;
      continue;
    }

    // Mode 2: soft match (normalizer detects same product under different name).
    const soft = cache.find((c) => {
      if (c.canonical === parsedCanonical) return true; // fast path: identical token set
      return looksLikeSameProduct(parsedIdent, { brand: c.brand, name: c.name });
    });

    if (soft) {
      // Union the wheel_vectors (max per leaf). Don't overwrite name/brand/specs
      // — the existing row is the authoritative identity.
      const existingVec = (soft.wheel_vector as WheelVector | null) ?? {};
      const mergedVec: WheelVector = { ...existingVec };
      for (const [leaf, score] of Object.entries(parsed.wheel_vector)) {
        mergedVec[leaf] = Math.max(mergedVec[leaf] ?? 0, score);
      }
      const mergedTrait = rollUpTraits(TYPE, mergedVec);

      const { error } = await supabase
        .from("products")
        .update({ wheel_vector: mergedVec, trait_vector: mergedTrait })
        .eq("id", soft.id);
      if (error) throw error;
      soft.wheel_vector = mergedVec;

      // Attach the CSV's flavor profile as a review so the bourbonExplorer
      // rating/descriptors stay traceable on the merged row.
      if (parsed.flavor_profile_raw.length > 0) {
        await supabase.from("product_reviews").insert({
          product_id: soft.id,
          source: "bourbonExplorer",
          source_url: "https://github.com/Cred1747/bourbonExplorer",
          text: parsed.flavor_profile_raw.join(", "),
          score: parsed.rating,
        });
      }
      enriched += 1;
      continue;
    }

    // Mode 3: fresh insert.
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        type: TYPE,
        name: parsed.name,
        brand: parsed.brand,
        specs: parsed.specs,
        wheel_version: WHEEL_VERSION,
        wheel_vector: parsed.wheel_vector,
        trait_vector: traitVector,
        status: "confirmed" as const,
        source: "seed" as const,
      })
      .select("id")
      .single();
    if (error || !created) throw error ?? new Error("insert returned no row");

    inserted += 1;
    cache.push({
      id: created.id,
      name: parsed.name,
      brand: parsed.brand,
      wheel_vector: parsed.wheel_vector,
      canonical: parsedCanonical,
    });

    if (parsed.flavor_profile_raw.length > 0) {
      await supabase.from("product_reviews").insert({
        product_id: created.id,
        source: "bourbonExplorer",
        source_url: "https://github.com/Cred1747/bourbonExplorer",
        text: parsed.flavor_profile_raw.join(", "),
        score: parsed.rating,
      });
    }
  }

  console.log(
    `[seed-bourbons] done. inserted=${inserted}, updated=${updated}, enriched=${enriched}`,
  );

  if (unmappedCounts.size > 0) {
    console.log("\n[seed-bourbons] top unmapped descriptors (consider for wheel v0.2):");
    const sorted = [...unmappedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [descriptor, count] of sorted) {
      console.log(`  ${count.toString().padStart(4)}  ${descriptor}`);
    }
  }
}

main().catch((err) => {
  console.error("[seed-bourbons] failed:", err);
  process.exit(1);
});
