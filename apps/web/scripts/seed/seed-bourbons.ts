/**
 * Seed the products table with bourbons from BourbonData.csv.
 *
 * - Idempotent: matches existing products by (type, brand, name) and updates
 *   instead of inserting duplicates on re-run.
 * - Computes trait_vector from wheel_vector at seed time.
 * - Stores the raw flavor profile text in product_reviews as a synthetic
 *   "bourbonExplorer" review for traceability + later enrichment.
 *
 * Run:  pnpm seed:bourbons
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ProductType, rollUpTraits } from "@/lib/wheel";
import { parseBourbonRow, type BourbonCsvRow } from "./lib/bourbon-parser";
import { readCsv } from "./lib/csv";
import { adminClient } from "./lib/supabase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "data", "BourbonData.csv");
const WHEEL_VERSION = "0.1";
const TYPE: ProductType = "bourbon";

async function main() {
  const supabase = adminClient();
  const rows = await readCsv<BourbonCsvRow>(CSV_PATH);
  console.log(`[seed-bourbons] read ${rows.length} rows from BourbonData.csv`);

  let inserted = 0;
  let updated = 0;
  const unmappedCounts = new Map<string, number>();

  for (const row of rows) {
    const parsed = parseBourbonRow(row);
    if (!parsed) continue;

    for (const u of parsed.unmapped_descriptors) {
      unmappedCounts.set(u, (unmappedCounts.get(u) ?? 0) + 1);
    }

    const traitVector = rollUpTraits(TYPE, parsed.wheel_vector);

    // Match existing product by (type, brand, name) to keep this idempotent.
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("type", TYPE)
      .eq("name", parsed.name)
      .eq("brand", parsed.brand ?? "")
      .maybeSingle();

    const payload = {
      type: TYPE,
      name: parsed.name,
      brand: parsed.brand,
      specs: parsed.specs,
      wheel_version: WHEEL_VERSION,
      wheel_vector: parsed.wheel_vector,
      trait_vector: traitVector,
      status: "confirmed" as const,
      source: "seed" as const,
    };

    if (existing) {
      const { error } = await supabase.from("products").update(payload).eq("id", existing.id);
      if (error) throw error;
      updated += 1;
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      inserted += 1;

      // Attach the raw flavor profile as a synthetic review for traceability.
      if (data && parsed.flavor_profile_raw.length > 0) {
        await supabase.from("product_reviews").insert({
          product_id: data.id,
          source: "bourbonExplorer",
          source_url: "https://github.com/Cred1747/bourbonExplorer",
          text: parsed.flavor_profile_raw.join(", "),
          score: parsed.rating,
        });
      }
    }
  }

  console.log(`[seed-bourbons] inserted ${inserted}, updated ${updated}`);

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
