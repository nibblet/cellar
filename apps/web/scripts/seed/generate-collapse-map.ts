/**
 * Generate catalog-collapse-map.json from curation flags on the live catalog.
 *
 *   pnpm generate:collapse-map
 *   pnpm generate:collapse-map --write
 *
 * Policy (May 2026): collapse when 2+ rows share the same `products.name` and
 * `specs.curation_collapse = Y`. Different canonical names stay separate rows
 * (e.g. Pappy 15 / 20 / 23). Release/batch/expression detail → tasting chips.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { adminClient } from "./lib/supabase-admin";

export {};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  specs: Record<string, unknown> | null;
  release_pattern: string | null;
};

type CollapseEntry = {
  old_product_id: string;
  new_product_id: string;
  old_name: string;
  expression_name: string;
  release_label: string;
  expression_chip?: string;
  vintages_matter?: boolean;
  release_pattern?: "year" | "batch" | "pick";
};

function specStr(specs: Record<string, unknown> | null, key: string): string | null {
  const v = specs?.[key];
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

function collapseFlag(p: ProductRow): boolean {
  return p.specs?.curation_collapse === "Y" || p.specs?.curation_collapse === true;
}

function releaseLabelFor(p: ProductRow): string | null {
  return (
    specStr(p.specs, "curation_release_label") ??
    (p.specs?.year_made != null ? String(p.specs.year_made) : null) ??
    specStr(p.specs, "curated_expression")
  );
}

function survivorScore(p: ProductRow): number {
  let score = 0;
  if (specStr(p.specs, "curated_expression")) score += 4;
  if (specStr(p.specs, "curation_release_label")) score += 2;
  if (p.specs?.year_made != null) score += 1;
  if (p.specs?.tier != null) score += 1;
  return score;
}

function pickSurvivor(rows: ProductRow[]): ProductRow {
  return [...rows].sort((a, b) => survivorScore(b) - survivorScore(a) || a.id.localeCompare(b.id))[0]!;
}

function inferReleasePattern(labels: string[]): "year" | "batch" | "pick" | undefined {
  if (labels.every((l) => /^\d{4}$/.test(l))) return "year";
  if (labels.some((l) => /batch|#/i.test(l))) return "batch";
  if (labels.some((l) => /pick|barrel|#/i.test(l))) return "pick";
  return undefined;
}

async function fetchProducts(): Promise<ProductRow[]> {
  const supa = adminClient();
  const all: ProductRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("products")
      .select("id, name, brand, specs, release_pattern")
      .eq("type", "bourbon")
      .eq("status", "confirmed")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
  }
  return all;
}

function buildCurationGroups(products: ProductRow[]): {
  entries: CollapseEntry[];
  skipped: Array<{ name: string; reason: string }>;
} {
  const entries: CollapseEntry[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  const byName = new Map<string, ProductRow[]>();
  for (const p of products) {
    const list = byName.get(p.name) ?? [];
    list.push(p);
    byName.set(p.name, list);
  }

  for (const [name, rows] of byName) {
    if (rows.length < 2) continue;

    const flagged = rows.filter(collapseFlag);
    if (flagged.length < 2) {
      if (flagged.length === 1 && rows.length > 1) {
        skipped.push({ name, reason: "partial_collapse_flags" });
      }
      continue;
    }

    const survivor = pickSurvivor(flagged);
    const variants = flagged.filter((p) => p.id !== survivor.id);
    const labels: string[] = [];

    for (const p of variants) {
      const release = releaseLabelFor(p);
      if (!release) {
        skipped.push({ name: p.name, reason: `no_release_label:${p.id}` });
        continue;
      }
      labels.push(release);
      const chip = specStr(p.specs, "curated_expression");
      entries.push({
        old_product_id: p.id,
        new_product_id: survivor.id,
        old_name: p.name,
        expression_name: name,
        release_label: release,
        expression_chip: chip && chip !== specStr(survivor.specs, "curated_expression") ? chip : undefined,
        vintages_matter: false,
        release_pattern: (survivor.release_pattern as CollapseEntry["release_pattern"]) ?? undefined,
      });
    }

    if (labels.length >= 2) {
      const pattern = inferReleasePattern(labels);
      if (pattern) {
        for (const e of entries) {
          if (e.expression_name === name) e.release_pattern = pattern;
        }
      }
    }
  }

  return { entries, skipped };
}

async function main() {
  const write = process.argv.includes("--write");
  const products = await fetchProducts();
  const { entries, skipped } = buildCurationGroups(products);

  entries.sort(
    (a, b) =>
      a.expression_name.localeCompare(b.expression_name) ||
      a.release_label.localeCompare(b.release_label, undefined, { numeric: true }),
  );

  const groups = new Set(entries.map((e) => e.expression_name));
  const outPath = resolve(process.cwd(), "../../data/catalog-collapse-map.json");
  const reviewPath = resolve(process.cwd(), "../../data/catalog-collapse-map.review.json");

  console.log(
    `[generate-collapse-map] ${entries.length} merge entries across ${groups.size} expressions`,
  );
  console.log(`[generate-collapse-map] skipped ${skipped.length} variants`);

  if (write) {
    writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`);
    writeFileSync(
      reviewPath,
      `${JSON.stringify({ generated_at: new Date().toISOString(), skipped, entries: entries.length, groups: groups.size }, null, 2)}\n`,
    );
    console.log(`\nWrote ${entries.length} entries → ${outPath}`);
    console.log(`Review log → ${reviewPath}`);
  } else {
    console.log(`\nDry run (pass --write to save). Sample:`);
    for (const e of entries.slice(0, 25)) {
      console.log(`  ${e.release_label.padEnd(12)} ← ${e.old_name} (${e.old_product_id.slice(0, 8)}…)`);
    }
    if (entries.length > 25) console.log(`  … and ${entries.length - 25} more`);
  }
}

main().catch((err) => {
  console.error("[generate-collapse-map] fatal:", err);
  process.exit(1);
});
