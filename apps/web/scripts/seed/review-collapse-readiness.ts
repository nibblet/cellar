/**
 * Post-fixup collapse readiness report.
 *   pnpm exec tsx --env-file=.env.local scripts/seed/review-collapse-readiness.ts
 */

import { adminClient } from "./lib/supabase-admin";

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  specs: Record<string, unknown> | null;
};

const NEVER = [/birthday bourbon/i, /george t\.?\s*stagg/i, /orphan barrel/i, /old fitzgerald/i];
const AGE = /\b\d{1,2}\s*(?:year|yr|years)\b/i;

function collapseFlag(p: ProductRow): boolean {
  return p.specs?.curation_collapse === "Y" || p.specs?.curation_collapse === true;
}

function expr(p: ProductRow): string | null {
  const e = p.specs?.curated_expression;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

function exprType(p: ProductRow): string | null {
  const t = p.specs?.expression_type;
  return typeof t === "string" ? t : null;
}

async function main() {
  const supa = adminClient();
  const { data, error } = await supa
    .from("products")
    .select("id, name, brand, specs")
    .eq("type", "bourbon")
    .eq("status", "confirmed")
    .order("name");
  if (error) throw error;

  const products = (data ?? []) as ProductRow[];
  const byName = new Map<string, ProductRow[]>();
  for (const p of products) {
    const arr = byName.get(p.name) ?? [];
    arr.push(p);
    byName.set(p.name, arr);
  }

  const ready: { name: string; count: number; brands: string[]; missingExpr: number }[] = [];
  const partial: { name: string; count: number; y: number; n: number; unset: number }[] = [];
  const neverLines: string[] = [];
  const blockedExprType: { name: string; count: number; types: string[] }[] = [];
  const ageInName: { name: string; count: number }[] = [];
  const candidates: { name: string; count: number; brands: string[] }[] = [];

  for (const [name, rows] of byName) {
    if (rows.length < 2) continue;
    const y = rows.filter(collapseFlag).length;
    const n = rows.filter((p) => p.specs?.curation_collapse === "N").length;
    const unset = rows.length - y - n;

    if (NEVER.some((re) => re.test(name))) {
      neverLines.push(name);
      continue;
    }
    if (rows.some((p) => AGE.test(p.name))) {
      ageInName.push({ name, count: rows.length });
      continue;
    }

    const types = [...new Set(rows.map(exprType).filter(Boolean))] as string[];
    const hasBlockingType = types.some((t) => t.toLowerCase() !== "straight bourbon");
    if (hasBlockingType) {
      blockedExprType.push({ name, count: rows.length, types });
      continue;
    }

    if (y === rows.length) {
      const brands = [...new Set(rows.map((p) => p.brand).filter(Boolean))] as string[];
      const missingExpr = rows.filter((p) => !expr(p)).length;
      ready.push({ name, count: rows.length, brands, missingExpr });
    } else if (y > 0) {
      partial.push({ name, count: rows.length, y, n, unset });
    } else {
      const brands = [...new Set(rows.map((p) => p.brand).filter(Boolean))] as string[];
      candidates.push({ name, count: rows.length, brands });
    }
  }

  ready.sort((a, b) => b.count - a.count);
  partial.sort((a, b) => b.count - a.count);
  candidates.sort((a, b) => b.count - a.count);

  const readyRows = ready.reduce((s, g) => s + g.count, 0);
  const candRows = candidates.reduce((s, g) => s + g.count, 0);

  console.log("=== CATALOG COLLAPSE REVIEW ===");
  console.log(`Total bourbon products: ${products.length}`);
  console.log(`Multi-row groups (2+): ${[...byName.values()].filter((g) => g.length >= 2).length}`);
  console.log("");
  console.log(
    `READY (all Y): ${ready.length} groups / ${readyRows} rows → ${ready.length} survivors, delete ${readyRows - ready.length}`,
  );
  console.log(`PARTIAL mixed: ${partial.length}`);
  console.log(`NEVER: ${neverLines.join(", ") || "(none)"}`);
  console.log(`BLOCKED age-in-name: ${ageInName.length} | expression_type: ${blockedExprType.length}`);
  console.log(`UNFLAGGED candidates: ${candidates.length} groups / ${candRows} rows`);
  console.log("");
  console.log("Top 30 ready groups:");
  for (const g of ready.slice(0, 30)) {
    const flags = [
      g.brands.length > 1 ? "multi-brand" : null,
      g.missingExpr ? `${g.missingExpr} missing expr` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`  ${g.count}x ${g.name}${flags ? ` ⚠ ${flags}` : ""}`);
  }

  if (partial.length) {
    console.log("\nPartial groups:");
    for (const g of partial) {
      console.log(`  ${g.name}: ${g.y}Y/${g.n}N/${g.unset}? of ${g.count}`);
    }
  } else {
    console.log("\nNo partial groups — every flagged group is fully Y.");
  }

  console.log("\nTop 25 unflagged candidates (aggressive collapse):");
  for (const g of candidates.slice(0, 25)) {
    console.log(`  ${g.count}x ${g.name} [${g.brands.join(", ")}]`);
  }

  const missingExprGroups = ready.filter((g) => g.missingExpr > 0);
  console.log(`\nReady groups missing expressions: ${missingExprGroups.length}`);
  for (const g of missingExprGroups) {
    console.log(`  ${g.name}: ${g.missingExpr}/${g.count}`);
  }

  const multiBrand = ready.filter((g) => g.brands.length > 1);
  console.log(`\nBrand conflicts in ready groups: ${multiBrand.length}`);
  for (const g of multiBrand) {
    console.log(`  ${g.name}: ${g.brands.join(" vs ")}`);
  }

  if (blockedExprType.length) {
    console.log("\nBlocked by expression_type (sample):");
    for (const g of blockedExprType.slice(0, 10)) {
      console.log(`  ${g.count}x ${g.name} [${g.types.join(", ")}]`);
    }
  }
}

main().catch((err) => {
  console.error("[review-collapse-readiness] failed:", err);
  process.exit(1);
});
