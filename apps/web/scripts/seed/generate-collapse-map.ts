/**
 * Generate catalog-collapse-map.json from curation flags on the live catalog.
 *
 *   pnpm generate:collapse-map
 *   pnpm generate:collapse-map --write
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCollapseAnalysis, type CatalogProductRow } from "@/lib/catalog/collapse-groups";
import { adminClient } from "./lib/supabase-admin";

async function fetchProducts(): Promise<CatalogProductRow[]> {
  const supa = adminClient();
  const all: CatalogProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, specs, release_pattern")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as CatalogProductRow[]));
  }
  return all;
}

async function main() {
  const write = process.argv.includes("--write");
  const products = await fetchProducts();
  const { entries, skipped, stats } = buildCollapseAnalysis(products);

  entries.sort(
    (a, b) =>
      a.expression_name.localeCompare(b.expression_name) ||
      (a.release_label ?? "").localeCompare(b.release_label ?? "", undefined, { numeric: true }),
  );

  const outPath = resolve(process.cwd(), "../../data/catalog-collapse-map.json");
  const reviewPath = resolve(process.cwd(), "../../data/catalog-collapse-map.review.json");

  console.log(
    `[generate-collapse-map] ${entries.length} merge entries across ${stats.expressionGroups} expressions`,
  );
  console.log(`[generate-collapse-map] skipped ${skipped.length} groups`);

  if (write) {
    writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`);
    writeFileSync(
      reviewPath,
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          skipped,
          entries: entries.length,
          groups: stats.expressionGroups,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`\nWrote ${entries.length} entries → ${outPath}`);
    console.log(`Review log → ${reviewPath}`);
  } else {
    console.log(`\nDry run (pass --write to save). Sample:`);
    for (const e of entries.slice(0, 25)) {
      const label = e.release_label ?? "(no label)";
      console.log(`  ${label.padEnd(12)} ← ${e.old_name} (${e.old_product_id.slice(0, 8)}…)`);
    }
    if (entries.length > 25) console.log(`  … and ${entries.length - 25} more`);
  }
}

main().catch((err) => {
  console.error("[generate-collapse-map] fatal:", err);
  process.exit(1);
});
